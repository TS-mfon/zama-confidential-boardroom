// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import "./ResultRevealAdapter.sol";

interface IBoardroomToken {
    function encryptedBalanceOf(address user) external view returns (euint64);
}

contract ConfidentialBoardroom is ZamaEthereumConfig {
    address public immutable owner;

    struct Proposal {
        uint256 id;
        string title;
        string description;
        string category;
        address proposer;
        uint64 startTime;
        uint64 endTime;
        bool finalized;
        bool revealRequested;
        euint64 forVotes;
        euint64 againstVotes;
        euint64 abstainVotes;
    }

    IBoardroomToken public immutable boardroomToken;
    ResultRevealAdapter public immutable resultAdapter;
    uint256 public nextProposalId = 1;

    mapping(uint256 => Proposal) private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event RevealPrepared(uint256 indexed proposalId);
    event ProposalFinalized(uint256 indexed proposalId);
    event FinalRevealSubmitted(uint256 indexed proposalId, uint64 forVotes, uint64 againstVotes, uint64 abstainVotes, bool passed);

    constructor(address token_, address adapter_) {
        owner = msg.sender;
        boardroomToken = IBoardroomToken(token_);
        resultAdapter = ResultRevealAdapter(adapter_);
    }

    modifier onlyProposalManager(uint256 proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == owner || msg.sender == proposal.proposer, "not proposal manager");
        _;
    }

    function createProposal(
        string calldata title,
        string calldata description,
        string calldata category,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 proposalId) {
        require(endTime > startTime, "bad window");
        proposalId = nextProposalId++;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.title = title;
        proposal.description = description;
        proposal.category = category;
        proposal.proposer = msg.sender;
        proposal.startTime = startTime;
        proposal.endTime = endTime;
        proposal.forVotes = FHE.asEuint64(0);
        proposal.againstVotes = FHE.asEuint64(0);
        proposal.abstainVotes = FHE.asEuint64(0);
        FHE.allowThis(proposal.forVotes);
        FHE.allowThis(proposal.againstVotes);
        FHE.allowThis(proposal.abstainVotes);

        emit ProposalCreated(proposalId, msg.sender, title);
    }

    function castVote(uint256 proposalId, externalEuint8 encryptedChoice, bytes calldata inputProof) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "vote not started");
        require(block.timestamp <= proposal.endTime, "vote ended");
        require(!hasVoted[proposalId][msg.sender], "already voted");

        euint8 choice = FHE.fromExternal(encryptedChoice, inputProof);
        euint64 weight = boardroomToken.encryptedBalanceOf(msg.sender);

        ebool isFor = FHE.eq(choice, FHE.asEuint8(1));
        ebool isAgainst = FHE.eq(choice, FHE.asEuint8(0));
        ebool isAbstain = FHE.eq(choice, FHE.asEuint8(2));

        proposal.forVotes = FHE.select(isFor, FHE.add(proposal.forVotes, weight), proposal.forVotes);
        proposal.againstVotes = FHE.select(isAgainst, FHE.add(proposal.againstVotes, weight), proposal.againstVotes);
        proposal.abstainVotes = FHE.select(isAbstain, FHE.add(proposal.abstainVotes, weight), proposal.abstainVotes);

        FHE.allowThis(proposal.forVotes);
        FHE.allowThis(proposal.againstVotes);
        FHE.allowThis(proposal.abstainVotes);

        hasVoted[proposalId][msg.sender] = true;
        emit VoteCast(proposalId, msg.sender);
    }

    function finalizeProposal(uint256 proposalId) external onlyProposalManager(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "vote active");
        require(!proposal.finalized, "finalized");
        proposal.finalized = true;
        emit ProposalFinalized(proposalId);
    }

    function prepareFinalReveal(uint256 proposalId) external onlyProposalManager(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.finalized, "not finalized");
        require(!proposal.revealRequested, "already requested");

        proposal.forVotes = FHE.makePubliclyDecryptable(proposal.forVotes);
        proposal.againstVotes = FHE.makePubliclyDecryptable(proposal.againstVotes);
        proposal.abstainVotes = FHE.makePubliclyDecryptable(proposal.abstainVotes);
        proposal.revealRequested = true;

        emit RevealPrepared(proposalId);
    }

    function submitFinalReveal(uint256 proposalId, bytes memory cleartexts, bytes memory decryptionProof) external onlyProposalManager(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.revealRequested, "reveal not prepared");

        bytes32[] memory handles = new bytes32[](3);
        handles[0] = FHE.toBytes32(proposal.forVotes);
        handles[1] = FHE.toBytes32(proposal.againstVotes);
        handles[2] = FHE.toBytes32(proposal.abstainVotes);

        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint64 forVotes, uint64 againstVotes, uint64 abstainVotes) = abi.decode(cleartexts, (uint64, uint64, uint64));
        bool passed = forVotes > againstVotes;

        resultAdapter.storeRevealedResult(proposalId, forVotes, againstVotes, abstainVotes, passed);
        emit FinalRevealSubmitted(proposalId, forVotes, againstVotes, abstainVotes, passed);
    }

    function getRevealHandles(uint256 proposalId) external view returns (bytes32 forVotesHandle, bytes32 againstVotesHandle, bytes32 abstainVotesHandle) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.revealRequested, "reveal not prepared");
        return (
            FHE.toBytes32(proposal.forVotes),
            FHE.toBytes32(proposal.againstVotes),
            FHE.toBytes32(proposal.abstainVotes)
        );
    }

    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        string memory title,
        string memory description,
        string memory category,
        address proposer,
        uint64 startTime,
        uint64 endTime,
        bool finalized,
        bool revealRequested
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.title,
            proposal.description,
            proposal.category,
            proposal.proposer,
            proposal.startTime,
            proposal.endTime,
            proposal.finalized,
            proposal.revealRequested
        );
    }

}

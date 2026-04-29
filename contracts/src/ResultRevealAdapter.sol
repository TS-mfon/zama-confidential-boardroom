// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ResultRevealAdapter {
    address public owner;
    address public boardroom;

    struct RevealedResult {
        uint64 forVotes;
        uint64 againstVotes;
        uint64 abstainVotes;
        bool passed;
        uint64 revealedAt;
    }

    mapping(uint256 => RevealedResult) private results;

    event ResultStored(uint256 indexed proposalId, uint64 forVotes, uint64 againstVotes, uint64 abstainVotes, bool passed);
    event BoardroomSet(address indexed boardroom);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyBoardroom() {
        require(msg.sender == boardroom, "not boardroom");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setBoardroom(address boardroom_) external onlyOwner {
        require(boardroom_ != address(0), "zero boardroom");
        boardroom = boardroom_;
        emit BoardroomSet(boardroom_);
    }

    function storeRevealedResult(
        uint256 proposalId,
        uint64 forVotes,
        uint64 againstVotes,
        uint64 abstainVotes,
        bool passed
    ) external onlyBoardroom {
        results[proposalId] = RevealedResult({
            forVotes: forVotes,
            againstVotes: againstVotes,
            abstainVotes: abstainVotes,
            passed: passed,
            revealedAt: uint64(block.timestamp)
        });
        emit ResultStored(proposalId, forVotes, againstVotes, abstainVotes, passed);
    }

    function getRevealedResult(uint256 proposalId) external view returns (RevealedResult memory) {
        return results[proposalId];
    }
}

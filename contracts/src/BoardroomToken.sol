// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract BoardroomToken is ZamaEthereumConfig {
    mapping(address => euint64) private balances;
    mapping(address => bool) public claimedDemoVotes;
    address public owner;
    uint64 public constant DEMO_VOTE_ALLOCATION = 100;

    event Minted(address indexed to);
    event DemoVotesClaimed(address indexed to, uint64 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function mint(address to, uint64 amount) external onlyOwner {
        _mint(to, amount);
    }

    function claimDemoVotes() external {
        require(!claimedDemoVotes[msg.sender], "already claimed");
        claimedDemoVotes[msg.sender] = true;
        _mint(msg.sender, DEMO_VOTE_ALLOCATION);
        emit DemoVotesClaimed(msg.sender, DEMO_VOTE_ALLOCATION);
    }

    function _mint(address to, uint64 amount) internal {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        balances[to] = FHE.add(balances[to], encryptedAmount);
        FHE.allowThis(balances[to]);
        FHE.allow(balances[to], to);
        emit Minted(to);
    }

    function encryptedBalanceOf(address user) external view returns (euint64) {
        return balances[user];
    }
}

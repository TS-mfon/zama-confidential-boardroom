// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/ResultRevealAdapter.sol";

contract BoardroomLayoutTest {
    function testStoreResult() public {
        ResultRevealAdapter adapter = new ResultRevealAdapter();
        adapter.setBoardroom(address(this));
        adapter.storeRevealedResult(1, 12, 9, 2, true);
        ResultRevealAdapter.RevealedResult memory result = adapter.getRevealedResult(1);
        require(result.forVotes == 12, "for mismatch");
        require(result.againstVotes == 9, "against mismatch");
    }
}

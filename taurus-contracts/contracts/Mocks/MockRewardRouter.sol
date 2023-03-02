// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRewardRouter {
    address public immutable testWeth;

    constructor(address _testWethAddress) {
        testWeth = _testWethAddress;
    }

    function claimFees() external {
        uint256 _balance = IERC20(testWeth).balanceOf(address(this));
        IERC20(testWeth).transfer(msg.sender, _balance);
    }

    function compound() external {
        // Does nothing, currently
    }
}

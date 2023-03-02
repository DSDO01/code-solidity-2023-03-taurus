// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISwapRouter02 } from "./ISwapRouter02.sol";

error incorrectOutputToken();

/**
 * @dev this contract exposes necessary logic to swap between tokens using Uniswap.
 * note that it should only hold tokens mid-transaction. Any tokens transferred in outside of a swap can be stolen.
 */
contract UniswapSwapAdapter {
    address public immutable swapRouter;

    constructor(address _swapRouter) {
        swapRouter = _swapRouter;
    }

    // exactInput
    function swap(address _outputToken, bytes calldata _swapData) external returns (uint256) {
        // Decode swap data
        (uint256 deadline, uint256 _amountIn, uint256 _amountOutMinimum, bytes memory _path) = abi.decode(
            _swapData,
            (uint256, uint256, uint256, bytes)
        );

        // Check that the outputToken is the final token in the path
        uint256 length = _swapData.length;
        address swapOutputToken = address(bytes20(_swapData[length - 41:length - 21]));

        if (swapOutputToken != _outputToken) {
            // The keeper-inputted Output Token differs from what the contract says it must be.
            revert incorrectOutputToken();
        }

        // Perform swap (this will fail if tokens haven't been transferred in, or haven't been approved)
        ISwapRouter02.ExactInputParams memory params = ISwapRouter02.ExactInputParams({
            path: _path,
            recipient: msg.sender,
            deadline: deadline,
            amountIn: _amountIn,
            amountOutMinimum: _amountOutMinimum
        });

        return ISwapRouter02(swapRouter).exactInput(params);
    }

    /**
     * @dev approve any token to the swapRouter.
     * note this is calleable by anyone.
     */
    function approveTokens(address _tokenIn) external {
        IERC20(_tokenIn).approve(swapRouter, type(uint256).max);
    }
}

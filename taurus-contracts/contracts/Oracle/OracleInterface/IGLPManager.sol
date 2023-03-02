// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IGLPManager {
    function getPrice(bool _maximise) external view returns (uint256);
}

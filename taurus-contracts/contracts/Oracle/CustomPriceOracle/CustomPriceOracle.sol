// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { IPriceOracle } from "../OracleInterface/IPriceOracle.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract CustomPriceOracle is IPriceOracle, Ownable {
    string public description;

    uint256 public currentPrice;
    uint256 public lastPrice;
    uint256 public lastUpdateTimestamp;
    uint8 public decimals;

    address public asset;

    uint8 public constant MAX_DECIMALS = 18;

    mapping(address => bool) private trustedNodes;

    modifier isTrusted() {
        if (!trustedNodes[msg.sender]) revert NotTrustedAddress();
        _;
    }

    modifier checkNonZeroAddress(address _addr) {
        if (_addr == address(0)) revert ZeroAddress();
        _;
    }

    constructor(string memory _description, address _underlying, uint8 _decimals) {
        if (_decimals > MAX_DECIMALS) revert InvalidDecimals();

        description = _description;
        decimals = _decimals;
        asset = _underlying;
    }

    function registerTrustedNode(address _node) external checkNonZeroAddress(_node) onlyOwner {
        trustedNodes[_node] = true;
        emit NodeRegistered(address(this), _node);
    }

    function unregisterTrustedNode(address _node) external checkNonZeroAddress(_node) onlyOwner {
        trustedNodes[_node] = false;
        emit NodeUnRegistered(address(this), _node);
    }

    function isTrustedNode(address _node) external view returns (bool) {
        return trustedNodes[_node];
    }

    function updatePrice(uint256 _newPrice) external isTrusted {
        lastPrice = currentPrice;
        currentPrice = _newPrice;
        lastUpdateTimestamp = block.timestamp;

        emit PriceUpdated(address(this), currentPrice, lastUpdateTimestamp);
    }

    function getLatestPrice(
        bytes calldata
    )
        external
        view
        override
        returns (uint256 _currentPrice, uint256 _lastPrice, uint256 _lastUpdateTimestamp, uint8 _decimals)
    {
        return (currentPrice, lastPrice, lastUpdateTimestamp, decimals);
    }
}

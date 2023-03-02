// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { BaseVault } from "../Vault/BaseVault.sol";

contract MockVault is BaseVault {
    function initialize(address _controller, address _tau, address _collateralToken) external initializer {
        __BaseVault_init(_controller, _tau, _collateralToken);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function populateUsers(
        address[] memory _accAddr,
        uint256[] memory _collateralAmount,
        uint256[] memory _debtAmount
    ) external {
        if (_collateralAmount.length != _debtAmount.length) revert indexOutOfBound();
        if (_accAddr.length != _debtAmount.length) revert indexOutOfBound();

        for (uint256 i; i < _accAddr.length; ++i) {
            userDetails[_accAddr[i]].collateral = _collateralAmount[i];
            userDetails[_accAddr[i]].debt = _debtAmount[i];
            userDetails[_accAddr[i]].startTimestamp = block.timestamp;
            userAddresses.push(_accAddr[i]);
        }
    }
}

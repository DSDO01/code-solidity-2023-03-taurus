// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { BaseVault } from "../Vault/BaseVault.sol";
import { Controllable } from "../Controller/Controllable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LiquidationBot is Controllable {
    using SafeERC20 for IERC20;

    // errors
    error wrongOffset(uint256);
    error oracleCorrupt();
    error insufficientFunds();

    // events
    event CollateralWithdrawn(address indexed userAddress, uint256 amount);

    struct LiqParams {
        address vaultAddress;
        address accountAddr;
        uint256 amount;
        bool offset;
    }
    // The offset is needed, because some portion of the debt will be recovered by updateRewards().
    // Hence, the value that we provide as an input will be slightly higher than the actual debt
    uint256 public percOffset = 1e2; // this is 1%

    // The precision for the offset
    uint256 public constant OFFSET_PRECISION = 1e4;

    uint256 public constant OFFSET_LIMIT = 1e3; // This signifies not more than 10%

    uint256 public offset;

    IERC20 public tau;

    constructor(address _tau, address _controller, uint256 _offset) Controllable(_controller) {
        offset = _offset;
        tau = IERC20(_tau);
    }

    function setParams(uint256 _offset) external onlyMultisig {
        offset = _offset;
    }

    /// @dev Function to set the offset percentage
    function setOffsetPercentage(uint256 _percOff) external onlyMultisig {
        if (_percOff > (OFFSET_LIMIT)) revert wrongOffset(_percOff);

        percOffset = _percOff;
    }

    /**
     * @dev approve any token to the swapRouter.
     * note this is calleable by anyone.
     */
    function approveTokens(address _tokenIn, address _vault) external onlyMultisig {
        IERC20(_tokenIn).approve(address(_vault), type(uint256).max);
    }

    /// @dev fetch the unhealthy accounts for the given vault
    function fetchUnhealthyAccounts(
        uint256 _startIndex,
        address _vaultAddress
    ) external view returns (address[] memory unhealthyAccounts) {
        BaseVault vault = BaseVault(_vaultAddress);
        address[] memory accounts = vault.getUsers(_startIndex, _startIndex + offset);
        uint256 j;

        for (uint256 i; i < accounts.length; ++i) {
            if (!vault.getAccountHealth(accounts[i])) j++;
        }

        unhealthyAccounts = new address[](j);
        j = 0;

        for (uint256 i; i < accounts.length; i++) {
            if (!vault.getAccountHealth(accounts[i])) unhealthyAccounts[j++] = accounts[i];
        }

        return unhealthyAccounts;
    }

    /// @dev This function can be invoked by any one to liquidate the account and returns true if succeeds, false otherwise
    /// note This function takes liquidation params as input in which the amount can be
    ///      provided either inclusive/exclusive of offset
    function liquidate(LiqParams memory _liqParams) external onlyKeeper returns (bool) {
        BaseVault vault = BaseVault(_liqParams.vaultAddress);
        uint256 newCalcAmt = _liqParams.amount;

        if (_liqParams.offset) {
            // Calculate the new amount by deducting the offset
            newCalcAmt -= ((newCalcAmt * percOffset) / OFFSET_PRECISION);
        }

        if (newCalcAmt > tau.balanceOf(address(this))) revert insufficientFunds();

        try vault.liquidate(_liqParams.accountAddr, newCalcAmt, 0) {
            return true;
        } catch Error(string memory) {
            // providing safe exit
            return false;
        }
    }

    function withdrawLiqRewards(address _token, uint256 _amount) external onlyMultisig {
        IERC20 collToken = IERC20(_token);
        if (_amount > collToken.balanceOf(address(this))) revert insufficientFunds();
        collToken.transfer(msg.sender, _amount);

        emit CollateralWithdrawn(msg.sender, _amount);
    }
}

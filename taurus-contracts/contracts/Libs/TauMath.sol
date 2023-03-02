// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import { Constants } from "./Constants.sol";

library TauMath {
    /**
     * @dev function to calculate the collateral ratio of an account.
     */
    function _computeCR(
        uint256 _coll,
        uint256 _debt,
        uint256 _price,
        uint8 priceDecimals
    ) internal pure returns (uint256) {
        if (_debt > 0) {
            uint256 newCollRatio = (_coll * _price * Constants.PRECISION) / (_debt * 10 ** priceDecimals);

            return newCollRatio;
        }
        // Return the maximal value for uint256 if the account has a debt of 0. Represents "infinite" CR.
        else {
            // if (_debt == 0)
            return type(uint256).max;
        }
    }
}

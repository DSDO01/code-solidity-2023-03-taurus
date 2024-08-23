// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint256 public constant PRECISION = 1e18;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(tx.origin, PRECISION * PRECISION);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

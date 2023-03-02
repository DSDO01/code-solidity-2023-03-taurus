// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

error notGovernance();
error mintLimitExceeded(uint256 newAmount, uint256 maxMintAmount);

contract TAU is ERC20, ERC20Burnable {
    address public governance;

    // Max amount of tokens which a given vault can mint. Since this is set to zero by default, there is no need to register vaults.
    mapping(address => uint256) public mintLimit;
    mapping(address => uint256) public currentMinted;

    constructor(address _governance) ERC20("TAU", "TAU") {
        governance = _governance;
    }

    /**
     * @dev Set new mint limit for a given vault. Only governance can call this function.
     * note if the new limit is lower than the vault's current amount minted, this will disable future mints for that vault,
        but will do nothing to its existing minted amount.
     * @param vault The address of the vault whose mintLimit will be updated
     * @param newLimit The new mint limit for the target vault
     */
    function setMintLimit(address vault, uint256 newLimit) external {
        if (msg.sender != governance) {
            revert notGovernance();
        }
        mintLimit[vault] = newLimit;
    }

    function mint(address recipient, uint256 amount) external {
        // Check whether mint amount exceeds mintLimit for msg.sender
        uint256 newMinted = currentMinted[msg.sender] + amount;
        if (newMinted > mintLimit[msg.sender]) {
            revert mintLimitExceeded(newMinted, mintLimit[msg.sender]);
        }

        // Update vault currentMinted
        currentMinted[msg.sender] = newMinted;

        // Mint TAU to recipient
        _mint(recipient, amount);
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual override {
        address account = _msgSender();
        _burn(account, amount);
        _decreaseCurrentMinted(account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's
     * allowance. Also decreases the burner's currentMinted amount if the burner is a vault.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `amount`.
     */
    function burnFrom(address account, uint256 amount) public virtual override {
        super.burnFrom(account, amount);
        _decreaseCurrentMinted(account, amount);
    }

    function _decreaseCurrentMinted(address account, uint256 amount) internal virtual {
        // If the burner is a vault, subtract burnt TAU from its currentMinted.
        // This has a few highly unimportant edge cases which can generally be rectified by increasing the relevant vault's mintLimit.
        uint256 accountMinted = currentMinted[account];
        if (accountMinted >= amount) {
            currentMinted[msg.sender] = accountMinted - amount;
        }
    }
}

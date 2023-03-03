
# Taurus contest details

- Join [Sherlock Discord](https://discord.gg/MABEWyASkp)
- Submit findings using the issue page in your private contest repo (label issues as med or high)
- [Read for more details](https://docs.sherlock.xyz/audits/watsons)

# Resources

[Taurus Protocol Documentation](https://docs.taurus.loans/)


# On-chain context
 
```
DEPLOYMENT: Arbitrum
ERC20: any non-rebasing. In particular, fee + staked GLP will be the first collateral token (managed through GMX's ERC20-compliant wrapper) and Arbitrum Weth will be the main yield token.
ERC721: none
ERC777: none
FEE-ON-TRANSFER: none
REBASING TOKENS: none
ADMIN: trusted
EXTERNAL-ADMINS: trusted
```

Please answer the following questions to provide more context: 
### Q: Are there any additional protocol roles? If yes, please explain in detail:
1) The roles
2) The actions those roles can take 
3) Outcomes that are expected from those roles 
4) Specific actions/outcomes NOT intended to be possible for those roles

A:
In order from most to least authority:
1. Governance. Entirely trusted. This role will be initially granted to the multisig.
2. Multisig. Trusted with essentially everything but user collateral. Among other things, this role can:
- Set protocol fees, up to 40%. This determines the amount of yield earned by user collateral which will be used to pay off user loans vs. redirected into the protocol itself.
- Direct protocol fees. Fees may be used to incentivize liquidity provision, claimed directly by the multisig, or otherwise used however the multisig decides.
- Pause vaults. Users can exit paused vaults, but otherwise no significant action should be possible on them.
3. Keepers. These are trusted with vault yield but not user collateral. They generally perform upkeep on the vault such as swapping yield for Tau and running the LiquidationBot. These are capable of stealing vault yield, but should not be able to steal user collateral.
4. Liquidators. These are simply trusted to liquidate accounts. It is intended that this role will eventually be deprecated and any account allowed to liquidate.

___
### Q: Is the code/contract expected to comply with any EIPs? Are there specific assumptions around adhering to those EIPs that Watsons should be aware of?
A: The code is not expected to comply with any EIPs.

___

### Q: Please list any known issues/acceptable risks that should not result in a valid finding.
A: In a situation where an account's debt is worth close to or more than the value of its collateral, liquidators should still be able to liquidate the account's debt at a discount. In the end this will result in some debt left in the system without any collateral backing it. This is an acceptable loss which will be covered by the system.

____
### Q: Please provide links to previous audits (if any).
A: There have been no previous audits.

___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, input validation expectations, etc)? 
A: Yes, two. 
1. Keepers will periodically scan the vault and liquidate any unhealthy accounts. This will be handled through the LiquidationBot, which will be supplied with sufficient Tau.
2. Keepers will periodically swap a portion of the vault yield for tau. 
_____

### Q: In case of external protocol integrations, are the risks of an external protocol pausing or executing an emergency withdrawal acceptable? If not, Watsons will submit issues related to these situations that can harm your protocol's functionality. 
A: ACCEPTABLE. Gmx certainly has the power to do so.


# Audit scope


[taurus-contracts @ 3759a646f5738890198eb7ae3964e4ecbe952d17](https://github.com/protokol/taurus-contracts/tree/3759a646f5738890198eb7ae3964e4ecbe952d17)
- [taurus-contracts/contracts/Controller/Controllable.sol](taurus-contracts/contracts/Controller/Controllable.sol)
- [taurus-contracts/contracts/Controller/ControllableUpgradeable.sol](taurus-contracts/contracts/Controller/ControllableUpgradeable.sol)
- [taurus-contracts/contracts/Controller/Controller.sol](taurus-contracts/contracts/Controller/Controller.sol)
- [taurus-contracts/contracts/Controller/SwapAdapterRegistry.sol](taurus-contracts/contracts/Controller/SwapAdapterRegistry.sol)
- [taurus-contracts/contracts/Libs/Constants.sol](taurus-contracts/contracts/Libs/Constants.sol)
- [taurus-contracts/contracts/Libs/ParseBytes.sol](taurus-contracts/contracts/Libs/ParseBytes.sol)
- [taurus-contracts/contracts/Libs/TauMath.sol](taurus-contracts/contracts/Libs/TauMath.sol)
- [taurus-contracts/contracts/LiquidationBot/LiquidationBot.sol](taurus-contracts/contracts/LiquidationBot/LiquidationBot.sol)
- [taurus-contracts/contracts/Oracle/CustomPriceOracle/CustomPriceOracle.sol](taurus-contracts/contracts/Oracle/CustomPriceOracle/CustomPriceOracle.sol)
- [taurus-contracts/contracts/Oracle/CustomPriceOracle/GLPPriceOracle.sol](taurus-contracts/contracts/Oracle/CustomPriceOracle/GLPPriceOracle.sol)
- [taurus-contracts/contracts/Oracle/OracleInterface/IGLPManager.sol](taurus-contracts/contracts/Oracle/OracleInterface/IGLPManager.sol)
- [taurus-contracts/contracts/Oracle/OracleInterface/IOracleWrapper.sol](taurus-contracts/contracts/Oracle/OracleInterface/IOracleWrapper.sol)
- [taurus-contracts/contracts/Oracle/OracleInterface/IPriceOracle.sol](taurus-contracts/contracts/Oracle/OracleInterface/IPriceOracle.sol)
- [taurus-contracts/contracts/Oracle/OracleInterface/IPriceOracleManager.sol](taurus-contracts/contracts/Oracle/OracleInterface/IPriceOracleManager.sol)
- [taurus-contracts/contracts/Oracle/PriceOracleManager.sol](taurus-contracts/contracts/Oracle/PriceOracleManager.sol)
- [taurus-contracts/contracts/Oracle/Wrapper/CustomOracleWrapper.sol](taurus-contracts/contracts/Oracle/Wrapper/CustomOracleWrapper.sol)
- [taurus-contracts/contracts/SwapAdapters/BaseSwapAdapter.sol](taurus-contracts/contracts/SwapAdapters/BaseSwapAdapter.sol)
- [taurus-contracts/contracts/SwapAdapters/ISwapRouter02.sol](taurus-contracts/contracts/SwapAdapters/ISwapRouter02.sol)
- [taurus-contracts/contracts/SwapAdapters/UniswapSwapAdapter.sol](taurus-contracts/contracts/SwapAdapters/UniswapSwapAdapter.sol)
- [taurus-contracts/contracts/TAU.sol](taurus-contracts/contracts/TAU.sol)
- [taurus-contracts/contracts/TGT.sol](taurus-contracts/contracts/TGT.sol)
- [taurus-contracts/contracts/Tokenomics/FeeSplitter.sol](taurus-contracts/contracts/Tokenomics/FeeSplitter.sol)
- [taurus-contracts/contracts/Vault/BaseVault.sol](taurus-contracts/contracts/Vault/BaseVault.sol)
- [taurus-contracts/contracts/Vault/FeeMapping.sol](taurus-contracts/contracts/Vault/FeeMapping.sol)
- [taurus-contracts/contracts/Vault/SwapHandler.sol](taurus-contracts/contracts/Vault/SwapHandler.sol)
- [taurus-contracts/contracts/Vault/TauDripFeed.sol](taurus-contracts/contracts/Vault/TauDripFeed.sol)
- [taurus-contracts/contracts/Vault/YieldAdapters/GMX/GmxYieldAdapter.sol](taurus-contracts/contracts/Vault/YieldAdapters/GMX/GmxYieldAdapter.sol)
- [taurus-contracts/contracts/Vault/YieldAdapters/GMX/IRewardRouter.sol](taurus-contracts/contracts/Vault/YieldAdapters/GMX/IRewardRouter.sol)



# About Taurus

Taurus is a self-repaying loan protocol built to be compatible with any yield-bearing token. The first collateral token will be GLP due to its high yields and stable nature. Users can use Taurus to leverage their GLP investment or gain liquidity while maintaining their GLP position.


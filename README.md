# {project} contest details

- Join [Sherlock Discord](https://discord.gg/MABEWyASkp)
- Submit findings using the issue page in your private contest repo (label issues as med or high)
- [Read for more details](https://docs.sherlock.xyz/audits/watsons)

# Resources

- [resource1](url)
- [resource2](url)

# On-chain context

TO FILL IN BY PROTOCOL

```
DEPLOYMENT: [e.g. mainnet, arbitrum, optimism, ..]
ERC20: [e.g. any, none, USDC, USDC and USDT]
ERC721: [e.g. any, none, UNI-V3]
ERC777: [e.g. any, none, {token name}]
FEE-ON-TRANSFER: [e.g. any, none, {token name}]
REBASING TOKENS: [e.g. any, none, {token name}]
ADMIN: [trusted, restricted, n/a]
EXTERNAL-ADMINS: [trusted, restricted, n/a]
```

In case of restricted, by default Sherlock does not consider direct protocol rug pulls as a valid issue unless the protocol clearly describes in detail the conditions for these restrictions. 
For contracts, owners, admins clearly distinguish the ones controlled by protocol vs user controlled. This helps watsons distinguish the risk factor. 
Example: 
* `ContractA.sol` is owned by the protocol. 
* `admin` in `ContractB` is restricted to changing properties in `functionA` and should not be able to liquidate assets or affect user withdrawals in any way. 
* `admin` in `ContractC` is user admin and is restricted to only `functionB`

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
- [taurus-contracts/contracts/Mocks/MockERC20.sol](taurus-contracts/contracts/Mocks/MockERC20.sol)
- [taurus-contracts/contracts/Mocks/MockRewardRouter.sol](taurus-contracts/contracts/Mocks/MockRewardRouter.sol)
- [taurus-contracts/contracts/Mocks/MockVault.sol](taurus-contracts/contracts/Mocks/MockVault.sol)
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



# About {project}

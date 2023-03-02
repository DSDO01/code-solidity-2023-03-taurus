// A few consts kept in a centralized location for easy access. Changing these will not change the solidity files, but should change
// all test files, deployment files etc.

import { BigNumber } from "ethers";
import { ethers } from "hardhat";

// Tau
export const TAU_DECIMALS = 18;

// Misc
export const PRECISION = BigNumber.from(10).pow(18); // Widely used number of decimals
export const DEFAULT_MAX_SLIPPAGE = PRECISION.div(50); // 2% max slippage. Note that this is the absolute max. Keepers will stil strive to minimize slippage.
export const SMALL_INIT_MINT_LIMIT = PRECISION.mul(1000); // 1000 TAU

// Uniswap
export const TEST_TAU_PER_WETH = BigNumber.from(2).pow(96).mul(1500); // 1500 TAU per WETH
export const HIGH_DEADLINE = 9920170954; // A high timestamp so that the deadline isn't reached
export const LARGE_POSITION_TOKEN_AMOUNT = BigNumber.from(10).pow(18).mul(100_000_000); // 100 million tokens of each

// Roles
export const KEEPER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("KEEPER_ROLE"));
export const GOVERNANCE_ROLE = ethers.constants.HashZero;
export const MULTISIG_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MULTISIG_ROLE"));
export const LIQUIDATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LIQUIDATOR_ROLE"));

// Fee keys
export const TAURUS_LIQUIDATION_FEE_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TAURUS_LIQUIDATION_FEE"));

// Addresses
export const PRICE_ORACLE_MANAGER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PRICE_ORACLE_MANAGER"));
export const FEE_SPLITTER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_SPLITTER"));

// SwapHandlers
export const UNISWAP_SWAP_ADAPTER_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UNISWAP_SWAP_ADAPTER_HASH"));
export const CURVE_SWAP_HANDLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CURVE_SWAP_HANDLER"));

// Gmx GLP addresses
export const ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS = "0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf"; // Contract which can be used to "transfer" fee_and_staked_GLP.
export const ARBITRUM_GLP_ADDRESS = "0x4277f8f2c384827b5273592ff7cebd9f2c1ac258"; // Unstaked GLP
export const ARBITRUM_FEE_GLP_ADDRESS = "0x4e971a87900b931fF39d1Aad67697F49835400b6"; // Fee GLP, distributes weth to GLP holders
export const ARBITRUM_FEE_AND_STAKED_GLP_ADDRESS = "0x1aDDD80E6039594eE970E5872D247bf0414C8903"; // fee + staked GLP, distributes esGmx to GLP holders
export const ARBITRUM_WETH_DISTRIBUTOR_ADDRESS = "0x5c04a12eb54a093c396f61355c6da0b15890150d"; // RewardDistributor for fee GLP. Distributes weth to the rewardTracker.
export const ARBITRUM_ESGMX_DISTRIBUTOR_ADDRESS_FOR_GLP = "0x60519b48ec4183a61ca2b8e37869e675fd203b34"; // RewardDistributor for staked GLP. Distributes esGMX.

// Gmx token addresses
export const ARBITRUM_ESGMX_ADDRESS = "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA";
export const ARBITRUM_BNGMX_ADDRESS = "0x35247165119B69A40edD5304969560D0ef486921";
export const ARBITRUM_FEE_GMX_ADDRESS = "0xd2D1162512F927a7e282Ef43a362659E4F2a728F"; // Staked + bonus + fee GMX, end of the line for GMX staking

// Other Gmx addresses
export const ARBITRUM_GMX_REWARD_ROUTER_ADDRESS = "0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1"; // RewardRouter
export const ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS = "0xB95DB5B167D75e6d04227CfFFA61069348d271F5"; // RewardRouterV2, meant (for now) to be used solely for minting and burning GLP.
export const ARBITRUM_GMX_DEPLOYER_ADDRESS = "0x5F799f365Fa8A2B60ac0429C48B153cA5a6f0Cf8"; // Governor for the RewardRouter
export const ARBITRUM_GMX_GOVERNANCE_ADDRESS = "0xe7E740Fa40CA16b15B621B49de8E9F0D69CF4858"; // GMX governance timelock
export const ARBITRUM_GLP_MANAGER = "0x3963FfC9dff443c2A94f21b129D429891E32ec18";

export const ARBITRUM_UNISWAP_V3_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
export const ARBITRUM_UNISWAP_V3_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const ARBITRUM_UNISWAP_V3_NFT_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

export const ARBITRUM_WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

export const GLP_PRICE_DECIMALS = 30;

// Signers
export const namedAccounts = [
  "deployer",
  "multisigPlaceholder", // Represents the team multisig
  "vaultPlaceholder", // Represents the vault
  "swapAdapterPlaceholder", // Represents the swap adapter
  "trustedNode", // Represents a signer trusted to contribute readings to an oracle
  "keeper", // Represents a signer who has been added as a keeper
  "user", // Represents an end user with no particular permissions
  "liquidator", // Represents a signer who can act as a liquidator
];

// Time
export const SECONDS_PER_YEAR = 86400 * 365;
export const DRIP_DURATION = 86400; // Rewards will take 24 hours to disburse to vault

// Fees
export const PERCENT_PRECISION = PRECISION;
export const GLP_VAULT_PROTOCOL_FEE_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GLP_VAULT_PROTOCOL_FEE"));
export const GLP_VAULT_PROTOCOL_FEE_VALUE = PERCENT_PRECISION.div(5); // 20% of fees go to the protocol, currently
export const MAX_FEE_PERC = PRECISION.mul(2).div(5); // Max, 40% of vault fees can go towards protocol, LP rewards, etc.

// Liquidation
export const MIN_COLL_RATIO: BigNumber = PRECISION.mul(120).div(100);
export const UNDERWATER_COLL_RATIO: BigNumber = PRECISION.mul(110).div(100);
export const MAX_LIQ_COLL_RATIO: BigNumber = PRECISION.mul(130).div(100);
export const LIQUIDATION_SURCHARGE = PRECISION.div(50); // 2% liquidation surcharge
export const MAX_LIQ_DISCOUNT = PRECISION.div(5);

// Deployment Info
export const INIT_TGT_MINT = PRECISION.mul(1_000_000);

// Governance proposal states
export const PROPOSAL_STATE = {
  Pending: 0,
  Active: 1,
  Canceled: 2,
  Defeated: 3,
  Succeeded: 4,
  Queued: 5,
  Expired: 6,
  Executed: 7,
};

// Governance deployment info
export const GOV_VOTE_DURATION_IN_SECONDS = 86400 * 7; // 1 week
export const ARBITRUM_VOTE_DURATION_IN_BLOCKS = GOV_VOTE_DURATION_IN_SECONDS / 0.3; // Arbitrum currently has a ~0.3 second block time
export const AVALANCHE_VOTE_DURATION_IN_BLOCKS = GOV_VOTE_DURATION_IN_SECONDS / 2; // Avalanche targets 2 second blocks
export const GOV_VOTE_DELAY_IN_BLOCKS = 1;
export const TIMELOCK_DURATION_IN_SECONDS = 86400 * 3; // 3 days
export const QUORUM_THRESHOLD = 4;

export const BYTES_BOOL_TRUE = ethers.utils.hexZeroPad(ethers.utils.hexlify(1), 32);
export const BYTES_BOOL_FALSE = ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32);

export const enum POSITIONS_STATE {
  Deposit = "Deposit",
  Withdraw = "Withdraw",
  Repay = "Repay",
  Borrow = "Borrow",
}

/* eslint-disable eqeqeq */
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import { config as dotenvConfig } from "dotenv";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import { HardhatUserConfig, NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

import "./tasks/accounts";
import "./tasks/balance";
import "./tasks/block-number";
import "./tasks/deployments/compile";
import "./tasks/deployments/clean";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3,
  bsc: 97,
  polygonmumbai: 80001,
  bscmainnet: 56,
  fuji: 43113,
  avax: 43114,
  arbitrum: 421611,
  polygonmainnet: 137,
  optimism: 10,
  optimismkovan: 69,
  optimismgoerli: 420,
  arbitrumrinkeby: 421611,
  sepolia: 11155111,
};

const networkNames = {
  ganache: "ganache",
  goerli: "goerli",
  hardhat: "hardhat",
  kovan: "kovan",
  mainnet: "mainnet",
  rinkeby: "rinkeby",
  ropsten: "ropsten",
  bsc: "bsc",
  polygonmumbai: "polygon-mumbai",
  bscmainnet: "bscmainnet",
  fuji: "avalanche-fuji",
  avax: "avalanche-mainnet",
  arbitrum: "arbitrum-mainnet",
  polygonmainnet: "polygon-mainnet",
  optimism: "optimism-mainnet",
  optimismkovan: "optimism-kovan",
  optimismgoerli: "optimism-goerli",
  arbitrumrinkeby: "arbitrum-rinkeby",
  sepolia: "sepolia",
};

// Ensure that we have all the environment variables we need.
if (!process.env.HH_USAGE) {
  throw new Error("Please set your HH_USAGE in a .env file");
}

let config: HardhatUserConfig;

// Ensure that we have all the environment variables we need.
let mnemonic: string;
if (!process.env.MNEMONIC) {
  throw new Error("Please set your MNEMONIC in a .env file");
} else {
  mnemonic = process.env.MNEMONIC;
}

if (!process.env.INFURA_API_KEY) {
  throw new Error("Please set your INFURA_API_KEY in a .env file");
}

const { INFURA_API_KEY, PRIVATE_KEY, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, OPTIMISTIC_API_KEY, ARBISCAN_API_KEY } =
  process.env;

function getUrl(network: keyof typeof chainIds): string {
  let url: string = "";
  // First will give preference to Infura key. If Infura is present, go for that, if not go for traditional method
  if (INFURA_API_KEY) {
    url = "https://" + networkNames[network] + ".infura.io/v3/" + INFURA_API_KEY;
  } else {
    if (network === "bsc") {
      url = "https://data-seed-prebsc-1-s2.binance.org:8545/";
    } else if (network === "bscmainnet") {
      url = "https://bsc-dataseed.binance.org/";
    } else if (network === "polygonmumbai") {
      url = "https://rpc-mumbai.matic.today";
    } else if (network === "fuji") {
      url = "https://api.avax-test.network/ext/bc/C/rpc";
    } else if (network === "avax") {
      url = "https://api.avax.network/ext/bc/C/rpc";
    } else if (network === "arbitrum") {
      url = "https://rinkeby.arbitrum.io/rpc";
    } else if (network === "polygonmainnet") {
      url = "https://polygon-mainnet.infura.io/v3/" + INFURA_API_KEY;
    }
  }

  return url;
}

function createTestnetConfig(network: keyof typeof chainIds): NetworkUserConfig {
  const url = getUrl(network);

  if (Number(process.env.HH_USAGE) === 0) {
    return {
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic,
        path: "m/44'/60'/0'/0",
      },
      chainId: chainIds[network],
      url,
      timeout: 1000000,
      gasMultiplier: 2,
      deploy: ["deploy/1-deploy-mocks", "deploy/3-deploy-core", "deploy/4-deploy-autotasks"],
    };
  } else {
    return {
      url,
      accounts: [`0x${PRIVATE_KEY}`],
      deploy: ["deploy/3-deploy-core"],
    };
  }
}

config = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
      forking: {
        url: getUrl("arbitrum"),
        blockNumber: 46924795,
      },
      deploy: ["deploy/2-deploy-test-contracts", "deploy/3-deploy-core", "deploy/4-deploy-autotasks"],
    },
    goerli: createTestnetConfig("goerli"),
    kovan: createTestnetConfig("kovan"),
    rinkeby: createTestnetConfig("rinkeby"),
    ropsten: createTestnetConfig("ropsten"),
    bsc: createTestnetConfig("bsc"),
    bscmainnet: createTestnetConfig("bscmainnet"),
    fuji: createTestnetConfig("fuji"),
    avax: createTestnetConfig("avax"),
    arbitrum: createTestnetConfig("arbitrum"),
    polygonmainnet: createTestnetConfig("polygonmainnet"),
    mumbai: createTestnetConfig("polygonmumbai"),
    optimism: createTestnetConfig("optimism"),
    optimismkovan: createTestnetConfig("optimismkovan"),
    optimismgoerli: createTestnetConfig("optimismgoerli"),
    arbitrumrinkeby: createTestnetConfig("arbitrumrinkeby"),
    sepolia: createTestnetConfig("sepolia"),
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY as string,

      ropsten: ETHERSCAN_API_KEY as string,
      rinkeby: ETHERSCAN_API_KEY as string,
      kovan: ETHERSCAN_API_KEY as string,
      goerli: ETHERSCAN_API_KEY as string,
      sepolia: ETHERSCAN_API_KEY as string,

      polygon: POLYGONSCAN_API_KEY as string,
      polygonMumbai: POLYGONSCAN_API_KEY as string,

      optimisticEthereum: OPTIMISTIC_API_KEY as string,
      optimisticKovan: OPTIMISTIC_API_KEY as string,

      arbitrumOne: ARBISCAN_API_KEY as string,
      // arbiscan: ARBISCAN_API_KEY as string,
    },
    customChains: [
      {
        network: "rinkeby",
        chainId: 4,
        urls: {
          apiURL: "https://api-rinkeby.etherscan.io/api",
          browserURL: "https://rinkeby.etherscan.io",
        },
      },
    ],
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.17",
    settings: {
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    timeout: 100000,
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};

export default config;

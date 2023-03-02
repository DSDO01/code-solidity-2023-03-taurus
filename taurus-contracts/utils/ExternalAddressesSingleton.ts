import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ARBITRUM_GMX_REWARD_ROUTER_ADDRESS,
  ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS,
  ARBITRUM_UNISWAP_V3_ROUTER_ADDRESS,
} from "../test/constants";

export class ExternalAddressesSingleton {
  private static instance: ExternalAddressesSingleton;

  // Addresses
  public erc20GlpAddress!: string;
  public rewardRouterAddress!: string;
  public uniV3SwapRouterAddress!: string;

  private async initialize(hre: HardhatRuntimeEnvironment) {
    // Set all addresses to either our mocks or to network addresses, depending on the network.
    const networkName = hre.network.name;

    if (networkName === "hardhat" || networkName === "arbitrum") {
      this.setupArbitrum();
    } else {
      await this.setupMocks(hre);
    }

    // Uniswap's addresses are generally the same for all networks, including testnets, except for CELO.
    this.uniV3SwapRouterAddress = ARBITRUM_UNISWAP_V3_ROUTER_ADDRESS;
  }

  public static async getInstance(hre: HardhatRuntimeEnvironment): Promise<ExternalAddressesSingleton> {
    if (!ExternalAddressesSingleton.instance) {
      ExternalAddressesSingleton.instance = new ExternalAddressesSingleton();
      await this.instance.initialize(hre);
    }
    return ExternalAddressesSingleton.instance;
  }

  private setupArbitrum() {
    this.erc20GlpAddress = ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS;
    this.rewardRouterAddress = ARBITRUM_GMX_REWARD_ROUTER_ADDRESS;
  }

  private async setupMocks(hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { deployments } = hre as DeploymentsExtension;

    /*
      For now, we'll use the deployed MOCK CONTRACTS.
      Note that fetching these contracts (rather than deploying them here) means that relevant deploy functions must always list mock deploy tags as dependencies.
    */
    this.erc20GlpAddress = (await deployments.get("MockErc20Glp")).address;
    this.rewardRouterAddress = (await deployments.get("MockRewardRouter")).address;
  }
}

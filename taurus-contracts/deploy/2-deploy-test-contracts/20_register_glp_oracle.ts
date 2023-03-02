import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CustomOracleWrapper, CustomPriceOracle, GLPPriceOracle, PriceOracleManager } from "typechain";

import { ARBITRUM_GLP_ADDRESS, ARBITRUM_GLP_MANAGER, GLP_PRICE_DECIMALS, TAU_DECIMALS } from "../../test/constants";
import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { ExternalAddressesSingleton } from "../../utils/ExternalAddressesSingleton";

// Note that most of this function must be updated when our oracle solution for TAU/GLP is finalized.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;

  const { deployer, trustedNode } = await getNamedSigners();

  const externalAddresses = await ExternalAddressesSingleton.getInstance(hre);

  // Get contracts
  const oracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;
  const customOracleWrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;

  // Deploy a custom oracle for USD/GLP
  await deployments.deploy("CustomPriceOracle", {
    from: deployer.address,
    args: ["TAU Custom Oracle", externalAddresses.erc20GlpAddress, TAU_DECIMALS],
    // Note that decimals is 18 here despite USDC having 6 decimals. USDC is being used as a placeholder for the value of $1.
    log: true,
  });

  const customOracle = (await getContract("CustomPriceOracle", deployer)) as CustomPriceOracle;

  // Deploy custom GLP price oracle
  await deployments.deploy("GLPPriceOracle", {
    from: deployer.address,
    args: ["GLP Price Oracle", ARBITRUM_GLP_ADDRESS, GLP_PRICE_DECIMALS, ARBITRUM_GLP_MANAGER],
    log: true,
  });

  const glpOracle = (await getContract("GLPPriceOracle", deployer)) as GLPPriceOracle;

  // Approve a node for it. Note that this must be updated before prod.
  await customOracle.registerTrustedNode(trustedNode.address);

  // Register the oracle to the CustomOracleWrapper
  await customOracleWrapper.addOracle(externalAddresses.erc20GlpAddress, customOracle.address);

  // Register GLP Oracle
  await customOracleWrapper.addOracle(ARBITRUM_GLP_ADDRESS, glpOracle.address);

  // Register custom oracle wrapper to handle tau/glp. Note that this should be updated before we go to prod.
  await oracleManager.setWrapper(externalAddresses.erc20GlpAddress, customOracleWrapper.address);
};

export default func;
func.tags = ["Mock", "Test", "GmxYieldAdapter", "GmxYieldAdapterOracle", "GLPPriceOracle"];
func.dependencies = ["TAU", "OracleManager", "Controller", "CustomOracle"];

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Controller, PriceOracleManager } from "typechain";

import { PRICE_ORACLE_MANAGER } from "../../test/constants";
import { deployAndRegisterCustomOracle } from "../../test/utils/helpers/oracleHelpers";
import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { ExternalAddressesSingleton } from "../../utils/ExternalAddressesSingleton";

// Note that since this deploy script relies on mocks, it has not been marked as "core" despite
// being a core component of the protocol. This script will need to be updated before it is
// ready for a true deployment.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;

  const { deployer, multisigPlaceholder } = await getNamedSigners();

  const tauAddress = (await deployments.get("TAU")).address;
  const controller = (await getContract("Controller", deployer)) as Controller;

  const externalAddresses = await ExternalAddressesSingleton.getInstance(hre);

  // Deploy the custom oracle wrapper
  await deployments.deploy("CustomOracleWrapper", {
    from: deployer.address,
    args: [],
    log: true,
  });
  await getContract("CustomOracleWrapper", deployer);

  // Deploy the price oracle manager
  await deployments.deploy("PriceOracleManager", {
    from: deployer.address,
    args: [],
    log: true,
  });
  const oracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;

  // Create custom USD/Tau oracle
  await deployAndRegisterCustomOracle(tauAddress, "USDC /  Oracle");

  await controller.connect(multisigPlaceholder).setAddress(PRICE_ORACLE_MANAGER, oracleManager.address);
};

export default func;
func.tags = ["Mock", "Test", "OracleManager", "CustomOracle"];
func.dependencies = ["TAU", "Controller"];

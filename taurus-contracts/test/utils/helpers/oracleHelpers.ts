import { deployments, ethers } from "hardhat";
import { CustomOracleWrapper, CustomPriceOracle, PriceOracleManager } from "typechain";

import { getContract, getNamedSigners } from "./testHelpers";

export const deployAndRegisterCustomOracle = async (baseTokenAddress: string, name: string, decimals?: number) => {
  const { deployer } = await getNamedSigners();
  const oracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;
  const customWrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;

  const customOracle = await deployCustomOracleHelper(baseTokenAddress, name, true, decimals);

  // Register the oracle
  await customWrapper.addOracle(baseTokenAddress, customOracle.address);
  if ((await oracleManager.wrapperAddressMap(baseTokenAddress)) === ethers.constants.AddressZero) {
    await oracleManager.setWrapper(baseTokenAddress, customWrapper.address);
  } else {
    await oracleManager.updateWrapper(baseTokenAddress, customWrapper.address);
  }

  return customOracle;
};

export const deployCustomOracleHelper = async (
  baseTokenAddress: string,
  name: string,
  registerNode?: boolean,
  decimals?: number,
) => {
  if (!decimals) {
    decimals = 18;
  }

  const { deployer, trustedNode } = await getNamedSigners();
  const deployment = await deployments.deploy("CustomPriceOracle", {
    from: deployer.address,
    args: [name, baseTokenAddress, decimals],
    log: true,
  });

  const customOracle = (await getContract("CustomPriceOracle", deployer, deployment.address)) as CustomPriceOracle;

  if (registerNode) {
    await customOracle.registerTrustedNode(trustedNode.address);
  }
  return customOracle;
};

export const getRegisteredOracle = async (baseTokenAddress: string) => {
  const { deployer } = await getNamedSigners();
  const oracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;
  const customWrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;

  const wrapperAddress = await oracleManager.wrapperAddressMap(baseTokenAddress);

  let oracleAddress: string;
  if (wrapperAddress === customWrapper.address) {
    oracleAddress = await customWrapper.oracles(baseTokenAddress);
  } else if (wrapperAddress === ethers.constants.AddressZero) {
    throw new Error("No oracle registered for these tokens");
  } else {
    throw new Error("Oracle uses unrecognized wrapper. This helper must be updated.");
  }
  return oracleAddress;
};

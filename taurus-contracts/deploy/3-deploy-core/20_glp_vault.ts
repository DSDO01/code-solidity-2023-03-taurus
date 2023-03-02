import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { GLP_VAULT_PROTOCOL_FEE_KEY, GLP_VAULT_PROTOCOL_FEE_VALUE, SMALL_INIT_MINT_LIMIT } from "../../test/constants";
import { ExternalAddressesSingleton } from "../../utils/ExternalAddressesSingleton";
import { TAU } from "../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, save } = deployments;

  const { multisigPlaceholder } = await getNamedSigners();

  const externalAddresses = await ExternalAddressesSingleton.getInstance(hre);

  const tauAddress = (await deployments.get("TAU")).address;
  const controllerAddress = (await deployments.get("Controller")).address;
  const collateralAddress = externalAddresses.erc20GlpAddress;
  const rewardRouterAddress = externalAddresses.rewardRouterAddress;

  const factory = await ethers.getContractFactory("GmxYieldAdapter");
  const contract = await upgrades.deployProxy(factory, [
    controllerAddress,
    tauAddress,
    collateralAddress,
    rewardRouterAddress,
  ]);
  await contract.deployed();

  // Save deployment
  const artifact = await deployments.getExtendedArtifact("GmxYieldAdapter");
  const proxyDeployments = {
    address: contract.address,
    ...artifact,
  };
  await save("GmxYieldAdapter", proxyDeployments);

  // Set up some fees
  const gmxVault = await getContract("GmxYieldAdapter", multisigPlaceholder);
  await gmxVault.addFeePerc([GLP_VAULT_PROTOCOL_FEE_KEY], [GLP_VAULT_PROTOCOL_FEE_VALUE]);

  // Give it a small mint limit
  const tau = (await hre.ethers.getContractAt("TAU", tauAddress, multisigPlaceholder)) as TAU;
  await tau.setMintLimit(contract.address, SMALL_INIT_MINT_LIMIT);
};

export default func;
func.tags = ["Core", "GmxYieldAdapter"];
func.dependencies = ["TAU", "Controller"];

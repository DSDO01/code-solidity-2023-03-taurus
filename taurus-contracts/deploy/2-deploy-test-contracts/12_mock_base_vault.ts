import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";
import {
  ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS,
  GLP_VAULT_PROTOCOL_FEE_KEY,
  GLP_VAULT_PROTOCOL_FEE_VALUE,
  SMALL_INIT_MINT_LIMIT,
} from "../../test/constants";
import { TAU } from "../../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, save } = deployments;

  const { multisigPlaceholder } = await getNamedSigners();

  const tauAddress = (await deployments.get("TAU")).address;
  const controllerAddress = (await deployments.get("Controller")).address;
  const collateralAddress = ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS;

  const factory = await ethers.getContractFactory("MockVault");
  const contract = await upgrades.deployProxy(factory, [controllerAddress, tauAddress, collateralAddress]);
  await contract.deployed();

  // Save deployment
  const artifact = await deployments.getExtendedArtifact("MockVault");
  const proxyDeployments = {
    address: contract.address,
    ...artifact,
  };
  await save("MockVault", proxyDeployments);

  // Set up some fees
  const gmxVault = await getContract("MockVault", multisigPlaceholder);
  await gmxVault.addFeePerc([GLP_VAULT_PROTOCOL_FEE_KEY], [GLP_VAULT_PROTOCOL_FEE_VALUE]);

  // Give it a small mint limit
  const tau = (await hre.ethers.getContractAt("TAU", tauAddress, multisigPlaceholder)) as TAU;
  await tau.setMintLimit(contract.address, SMALL_INIT_MINT_LIMIT);
};

export default func;
func.tags = ["Test", "MockBaseVault"];
func.dependencies = ["TAU", "Controller"];

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Controller } from "typechain";

import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { LIQUIDATOR_ROLE } from "../../test/constants";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer, multisigPlaceholder, liquidator } = await getNamedSigners();

  const tauAddress = (await deployments.get("TAU")).address;
  const tgtAddress = (await deployments.get("TGT")).address;
  await deploy("Controller", {
    from: deployer.address,
    args: [
      tauAddress,
      tgtAddress,
      multisigPlaceholder.address, // For now multisig is default admin. In the future, ownership may pass to a governance module.
      multisigPlaceholder.address, // For now we'll just pass in the third signer as the multisig. In the future this will be the multisig.
    ],
    log: true,

    deterministicDeployment: process.env.DETERMINISTIC === "true",
  });

  const ctrl = (await getContract("Controller", multisigPlaceholder)) as Controller;
  await ctrl.grantRole(LIQUIDATOR_ROLE, liquidator.address);
};

export default func;
func.tags = ["Core", "Controller"];
func.dependencies = ["TAU", "TGT"];

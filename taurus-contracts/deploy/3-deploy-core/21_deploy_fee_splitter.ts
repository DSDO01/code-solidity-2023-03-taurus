import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Controller } from "typechain";

import { FEE_SPLITTER } from "../../test/constants";
import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer, multisigPlaceholder } = await getNamedSigners();

  const controller = (await getContract("Controller", multisigPlaceholder)) as Controller;

  const feeSplitterResult = await deploy("FeeSplitter", {
    from: deployer.address,
    args: [controller.address],
    log: true,
  });

  // Once the fee recipient contracts have been set up, we'll need to setFeeRecipients as well.

  // Register it with the controller
  await controller.setAddress(FEE_SPLITTER, feeSplitterResult.address);
};

export default func;
func.tags = ["Core", "FeeSplitter"];
func.dependencies = ["Controller"];

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { FeeSplitter } from "typechain";

import { PERCENT_PRECISION } from "../../test/constants";
import { getContract, getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;

  const { multisigPlaceholder } = await getNamedSigners();

  const feeSplitter = (await getContract("FeeSplitter", multisigPlaceholder)) as FeeSplitter;

  // Register multisig as sole recipient of fee splitter (more will be added here later, especially LP rewards)
  await feeSplitter.setFeeRecipients([{ recipient: multisigPlaceholder.address, proportion: PERCENT_PRECISION }]);
};

export default func;
func.tags = ["Core", "RegisterFeeSplitterRecipients"];
func.dependencies = ["FeeSplitter"];

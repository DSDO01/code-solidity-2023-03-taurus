import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer, multisigPlaceholder } = await getNamedSigners();

  await deploy("TAU", {
    from: deployer.address,
    args: [multisigPlaceholder.address], // For now we'll just pass in the second signer as governance. In the future this will be the governance contract.
    log: true,

    deterministicDeployment: process.env.DETERMINISTIC === "true",
  });
};

export default func;
func.tags = ["Core", "TAU"];

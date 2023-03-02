import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  // Deploy TGT
  await deploy("TGT", {
    from: deployer.address,
    args: [],
    log: true,
  });
};

export default func;
func.tags = ["Core", "TGT"];

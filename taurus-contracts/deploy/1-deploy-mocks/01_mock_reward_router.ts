import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  const testWeth = await deployments.get("WETH");

  await deploy("MockRewardRouter", {
    from: deployer.address,
    args: [testWeth.address],
    log: true,
  });
};

export default func;
func.tags = ["Mock", "MockGmx", "MockRewardRouter"];
func.dependencies = ["MockTokens"];

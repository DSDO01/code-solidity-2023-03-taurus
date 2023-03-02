import { BigNumber } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  const tauAddress = (await deployments.get("TAU")).address;
  const controllerAddress = (await deployments.get("Controller")).address;
  const offsetMultiple = BigNumber.from("10");

  await deploy("LiquidationBot", {
    from: deployer.address,
    args: [tauAddress, controllerAddress, offsetMultiple],
    log: true,
    deterministicDeployment: process.env.DETERMINISTIC === "true",
  });
};

export default func;
func.tags = ["Autotasks", "LiquidationBot"];
func.dependencies = ["TAU", "Controller"];

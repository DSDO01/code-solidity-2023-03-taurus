import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { ExternalAddressesSingleton } from "../../utils/ExternalAddressesSingleton";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  const externalAddresses = await ExternalAddressesSingleton.getInstance(hre);
  const swapRouterAddress = externalAddresses.uniV3SwapRouterAddress;

  await deploy("UniswapSwapAdapter", {
    from: deployer.address,
    args: [swapRouterAddress],
    log: true,
    deterministicDeployment: process.env.DETERMINISTIC === "true",
  });
};

export default func;
func.tags = ["Core", "SwapAdapter", "UniswapSwapAdapter"];
// No dependencies

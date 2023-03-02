import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  const tokenConfig = [
    { name: "WETH", symbol: "WETH" },
    { name: "MockErc20Glp", symbol: "MockGLP" },
    { name: "MockUSDC", symbol: "USDC" },
  ];

  // For each config, deploy an ERC20 token
  for (const config of tokenConfig) {
    await deploy(config.name, {
      from: deployer.address,
      contract: "MockERC20",
      args: [config.name, config.symbol],
      log: true,
    });
  }
};

export default func;
func.tags = ["Mock", "MockTokens", "MockGmx"];
// No dependencies

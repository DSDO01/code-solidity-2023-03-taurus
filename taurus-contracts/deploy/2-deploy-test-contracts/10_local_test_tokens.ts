import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { getNamedSigners } from "../../test/utils/helpers/testHelpers";

// These tokens are used only by arbitrum-forking tests, which is why they're here rather than listed with the mock tokens.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedSigners();

  const tokenConfig = [
    { name: "TestUSDT", symbol: "tUSDT" },
    { name: "TestDAI", symbol: "tDAI" },
  ];

  // For each config, deploy an ERC20 token
  for (const config of tokenConfig) {
    await deploy(config.name, {
      from: deployer.address,
      contract: "MockERC20",
      args: [config.name, config.symbol],
      log: true,
      deterministicDeployment: process.env.DETERMINISTIC === "true",
    });
  }
};

export default func;
func.tags = ["Test", "TestTokens", "Uniswap"];
// No dependencies

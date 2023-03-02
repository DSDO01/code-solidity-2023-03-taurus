import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ERC20 } from "typechain";

import { MintMethod, setupPoolHelper } from "../../test/utils/helpers/uniswapHelpers";
import { getNamedSigners } from "../../test/utils/helpers/testHelpers";
import { Erc20Artifacts } from "../../test/utils/ImportedArtifacts/Erc20Artifacts";
import { ARBITRUM_WETH_ADDRESS, PRECISION, TEST_TAU_PER_WETH } from "../../test/constants";

// Create a Uniswap pool between 2 test tokens, and mint a position in that pool through the nftManager.
// This script is used only for local node tests.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;

  const { deployer } = await getNamedSigners();

  const testUsdtDeployment = await deployments.get("TestUSDT");
  const testDaiDeployment = await deployments.get("TestDAI");
  const tauDeployment = await deployments.get("TAU");

  const testUsdt = (await hre.ethers.getContractAt("MockERC20", testUsdtDeployment.address, deployer)) as ERC20;
  const testDai = (await hre.ethers.getContractAt("MockERC20", testDaiDeployment.address, deployer)) as ERC20;
  const tau = (await hre.ethers.getContractAt("TAU", tauDeployment.address, deployer)) as ERC20;
  const weth = (await hre.ethers.getContractAt(
    Erc20Artifacts.arbitrumWethAbi,
    ARBITRUM_WETH_ADDRESS,
    deployer,
  )) as ERC20;

  // Create pool between USDT and DAI.
  await setupPoolHelper([testUsdt, testDai], [MintMethod.mock, MintMethod.mock], deployer);

  // Create pool between DAI and TAU.
  await setupPoolHelper([tau, testDai], [MintMethod.tauOrTgt, MintMethod.mock], deployer);

  // Create pool between USDT and TAU.
  await setupPoolHelper([tau, testUsdt], [MintMethod.tauOrTgt, MintMethod.mock], deployer);

  // Create pool between WETH and TAU.
  await setupPoolHelper(
    [weth, tau],
    [MintMethod.weth, MintMethod.tauOrTgt],
    deployer,
    PRECISION.mul(1_000_000),
    TEST_TAU_PER_WETH,
  );
};

export default func;
func.tags = ["Test", "Uniswap"];
func.dependencies = ["TestTokens", "TAU", "TGT"]; // Dependent on core Uniswap contracts and test tokens being deployed first.

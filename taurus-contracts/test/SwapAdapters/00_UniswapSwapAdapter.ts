import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { ERC20, UniswapSwapAdapter } from "typechain";
import { Contract } from "ethers";

import { UniswapArtifacts } from "../utils/ImportedArtifacts/UniswapArtifacts";
import { ARBITRUM_UNISWAP_V3_ROUTER_ADDRESS, PRECISION } from "../constants";
import { buildUniswapSwapAdapterData } from "../utils/helpers/swapAdapterHelpers";
import { getContract, getNamedSigners } from "../utils/helpers/testHelpers";

describe("UniswapSwapAdapter", function () {
  let [deployer, keeper]: SignerWithAddress[] = [];

  let swapAdapter: UniswapSwapAdapter;
  let swapRouter: Contract;

  let testUSDT: ERC20;
  let testDAI: ERC20;

  const testDepositAmount = PRECISION.mul(100);
  const expectedReturnAmount = PRECISION.mul(99);

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();

    // Get signers
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    keeper = signers.keeper;

    // Get test ERC20 contracts
    testUSDT = (await getContract("TestUSDT", deployer)) as ERC20;
    testDAI = (await getContract("TestDAI", deployer)) as ERC20;

    // Get contracts
    swapAdapter = (await getContract("UniswapSwapAdapter", deployer)) as UniswapSwapAdapter;
    swapRouter = await ethers.getContractAt(
      UniswapArtifacts.SwapRouter.abi,
      ARBITRUM_UNISWAP_V3_ROUTER_ADDRESS,
      deployer,
    );
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Approve", async () => {
    it("anyone should be able to approve the max amount of any token to the swapRouter", async () => {
      // Approve DAI
      await swapAdapter.connect(keeper).approveTokens(testDAI.address);
      expect(await testDAI.allowance(swapAdapter.address, swapRouter.address)).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe("Swap", async () => {
    // let path: string;
    let basicSwapParams: string;
    const setupTokensFixture = deployments.createFixture(async () => {
      // Approve DAI
      await swapAdapter.connect(keeper).approveTokens(testDAI.address);
      expect(await testDAI.allowance(swapAdapter.address, swapRouter.address)).to.equal(ethers.constants.MaxUint256);

      // Get generic swap parameters
      basicSwapParams = buildUniswapSwapAdapterData(
        [testDAI.address, testUSDT.address],
        [3000],
        testDepositAmount,
        expectedReturnAmount,
        0,
      ).swapData;
    });

    beforeEach(async function () {
      await setupTokensFixture();
    });

    it("should fail to swap if tokens have not been deposited", async () => {
      await expect(swapAdapter.swap(testUSDT.address, basicSwapParams)).to.be.revertedWith("STF");
    });

    it("should fail to swap if deadline has passed", async () => {
      const oldSwapParams = buildUniswapSwapAdapterData(
        [testDAI.address, testUSDT.address],
        [3000],
        testDepositAmount,
        expectedReturnAmount,
        0,
        0, // Deadline is 0 so deadline has already passed
      );
      await expect(swapAdapter.swap(testUSDT.address, oldSwapParams.swapData)).to.be.revertedWith(
        "Transaction too old",
      );
    });

    it("should fail to swap if tokens have not been approved", async () => {
      await expect(swapAdapter.swap(testUSDT.address, basicSwapParams)).to.be.revertedWith("STF");
    });

    it("should fail to swap if the outputToken is not correct", async () => {
      // Run swap
      await expect(swapAdapter.swap(testDAI.address, basicSwapParams)).to.be.revertedWithCustomError(
        swapAdapter,
        "incorrectOutputToken",
      );
    });

    it("should be able to swap if it has the correct tokens", async () => {
      const usdtBalanceBefore = await testUSDT.balanceOf(deployer.address);
      // Deposit tokens
      await testDAI.transfer(swapAdapter.address, testDepositAmount);

      // Run swap
      await swapAdapter.swap(testUSDT.address, basicSwapParams);

      const usdtBalanceAfter = await testUSDT.balanceOf(deployer.address);
      expect(usdtBalanceAfter.sub(usdtBalanceBefore)).to.be.greaterThan(expectedReturnAmount);
    });

    it("should revert if slippage has been too great", async () => {
      // Deposit tokens
      await testDAI.transfer(swapAdapter.address, testDepositAmount);

      const badSwapParams = buildUniswapSwapAdapterData(
        [testDAI.address, testUSDT.address],
        [3000],
        testDepositAmount,
        testDepositAmount, // No allowance for any slippage
        0,
      );
      // Run swap
      await expect(swapAdapter.swap(testUSDT.address, badSwapParams.swapData)).to.be.revertedWith(
        "Too little received",
      );
    });
  });
});

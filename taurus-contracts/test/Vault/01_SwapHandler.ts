import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployments, ethers } from "hardhat";
import {
  Controller,
  CustomOracleWrapper,
  CustomPriceOracle,
  ERC20,
  FeeSplitter,
  PriceOracleManager,
  SwapHandler,
  TAU,
  UniswapSwapAdapter,
} from "typechain";

import {
  ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS,
  GLP_VAULT_PROTOCOL_FEE_KEY,
  GLP_VAULT_PROTOCOL_FEE_VALUE,
  KEEPER_ROLE,
  PRECISION,
  TAU_DECIMALS,
  UNISWAP_SWAP_ADAPTER_HASH,
} from "../constants";
import { buildUniswapSwapAdapterData, formatSwapRouterPath, swapCalculator } from "../utils/helpers/swapAdapterHelpers";
import { getContract, getNamedSigners } from "../utils/helpers/testHelpers";

describe("SwapHandler", function () {
  let [deployer, multisigPlaceholder, keeper, trustedNode]: SignerWithAddress[] = [];

  let swapAdapter: UniswapSwapAdapter;
  let swapHandler: SwapHandler;
  let controller: Controller;
  let oracleManager: PriceOracleManager;
  let customOracleWrapper: CustomOracleWrapper;
  let feeSplitter: FeeSplitter;

  let testDAI: ERC20;
  let tau: TAU;

  const testDepositAmount = PRECISION.mul(100);
  const reasonableSlippage = PRECISION.mul(99).div(100);
  let minReturnAmount: BigNumber;

  // Params we get after deployment
  let protocolFee: BigNumber;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();

    // Get signers
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    multisigPlaceholder = signers.multisigPlaceholder;
    keeper = signers.keeper;
    trustedNode = signers.trustedNode;

    // Get ERC20 contracts
    testDAI = (await getContract("TestDAI", deployer)) as ERC20;
    tau = (await getContract("TAU", deployer)) as TAU;

    // Get contracts
    swapAdapter = (await getContract("UniswapSwapAdapter", deployer)) as UniswapSwapAdapter;
    controller = (await getContract("Controller", deployer)) as Controller;
    oracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;
    customOracleWrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;
    feeSplitter = (await getContract("FeeSplitter", deployer)) as FeeSplitter;
    swapHandler = (await getContract("MockVault", deployer)) as SwapHandler;

    // Approve swap adapter to handle testDai
    await swapAdapter.approveTokens(testDAI.address);

    // Set up keeper as a keeper
    await controller.connect(multisigPlaceholder).grantRole(KEEPER_ROLE, keeper.address);

    // Set up swap fees
    await swapHandler
      .connect(multisigPlaceholder)
      .addFeePerc([GLP_VAULT_PROTOCOL_FEE_KEY], [GLP_VAULT_PROTOCOL_FEE_VALUE]);

    protocolFee = await swapHandler.getFeePerc(GLP_VAULT_PROTOCOL_FEE_KEY);

    const basicSwapData = await swapCalculator(PRECISION, testDepositAmount, protocolFee, PRECISION.div(100));
    minReturnAmount = basicSwapData.minTokensReturned;
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Working oracle", async () => {
    const addOracleReadingFixture = deployments.createFixture(async () => {
      await setupFixture();

      // Set up a testDAI-TAU oracle
      await deployments.deploy("testDAI-TAU Oracle", {
        contract: "CustomPriceOracle",
        from: deployer.address,
        args: ["testDAI-TAU Oracle", testDAI.address, TAU_DECIMALS],
        log: true,
      });
      const testDaiOracle = (await getContract("testDAI-TAU Oracle", deployer)) as CustomPriceOracle;
      await customOracleWrapper.addOracle(testDAI.address, testDaiOracle.address);
      await oracleManager.setWrapper(testDAI.address, customOracleWrapper.address);

      await testDaiOracle.registerTrustedNode(trustedNode.address);

      // Add oracle reading setting testDAI to being worth 1
      await testDaiOracle.connect(trustedNode).updatePrice(PRECISION);
    });

    beforeEach(async function () {
      await addOracleReadingFixture();
    });

    describe("Swap", async () => {
      let path: string;
      let basicSwapParams: string;
      let initTauSupply: BigNumber;

      const setupSwapFixture = deployments.createFixture(async () => {
        await addOracleReadingFixture();
        // Approve DAI
        await swapAdapter.connect(keeper).approveTokens(testDAI.address);

        // Get path
        path = formatSwapRouterPath([testDAI.address, tau.address], [3000]);

        // Set up basic swap parameters
        const swapData = buildUniswapSwapAdapterData(
          [testDAI.address, tau.address],
          [3000],
          testDepositAmount,
          minReturnAmount,
          protocolFee,
        );

        basicSwapParams = swapData.swapData;
        initTauSupply = await tau.totalSupply();
      });

      beforeEach(async function () {
        await setupSwapFixture();
      });

      it("Only keepers can call swapForTau", async () => {
        await expect(
          swapHandler.swapForTau(testDAI.address, 100, 0, ethers.constants.HashZero, PRECISION, "0x10"),
        ).to.be.revertedWithCustomError(swapHandler, "notKeeper");
      });

      it("cannot swap the collateral token", async () => {
        await expect(
          swapHandler
            .connect(keeper)
            .swapForTau(ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS, 100, 0, ethers.constants.HashZero, PRECISION, "0x10"),
        ).to.be.revertedWithCustomError(swapHandler, "tokenCannotBeSwapped");
      });

      it("cannot swap if the SwapAdapter is not registered", async () => {
        await expect(
          swapHandler.connect(keeper).swapForTau(testDAI.address, 100, 0, ethers.constants.HashZero, PRECISION, "0x10"),
        ).to.be.revertedWithCustomError(swapHandler, "unregisteredSwapAdapter");
      });

      describe("Registered swap", async () => {
        const registerSwapFixture = deployments.createFixture(async () => {
          // Register the swap adapter
          await controller
            .connect(multisigPlaceholder)
            .registerSwapAdapter(UNISWAP_SWAP_ADAPTER_HASH, swapAdapter.address);
          expect(await controller.swapAdapters(UNISWAP_SWAP_ADAPTER_HASH)).to.equal(swapAdapter.address);
        });

        beforeEach(async function () {
          await registerSwapFixture();
        });

        it("should revert if it lacks tokens", async () => {
          await expect(
            swapHandler.connect(keeper).swapForTau(testDAI.address, 100, 0, UNISWAP_SWAP_ADAPTER_HASH, PRECISION, path),
          ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        describe("Swap with sufficient tokens", async () => {
          const addTokensFixture = deployments.createFixture(async () => {
            // Transfer some testDAI to the SwapHandler
            await testDAI.transfer(swapHandler.address, testDepositAmount);
          });

          beforeEach(async function () {
            await addTokensFixture();
          });

          it("can successfully swap into tau", async () => {
            // Swap it to TAU
            await swapHandler
              .connect(keeper)
              .swapForTau(
                testDAI.address,
                testDepositAmount,
                minReturnAmount,
                UNISWAP_SWAP_ADAPTER_HASH,
                PRECISION,
                basicSwapParams,
              );

            const expectedSwapDetails = swapCalculator(
              PRECISION,
              testDepositAmount,
              GLP_VAULT_PROTOCOL_FEE_VALUE,
              reasonableSlippage,
            );

            // Check that TAU total supply has decreased and vault mintLimit has increased
            const finalTauSupply = await tau.totalSupply();
            const diff = initTauSupply.sub(finalTauSupply);
            expect(diff).to.be.greaterThan(expectedSwapDetails.minTokensReturned);
            expect(diff).to.be.lessThan(expectedSwapDetails.maxTokensReturned);

            // Check that the tokensWithheld are correct
            expect(await swapHandler.tauWithheld()).to.equal(diff);

            // Check that FeeSplitter has received the correct amount of tokens
            const feeSplitterBalance = await testDAI.balanceOf(feeSplitter.address);
            expect(feeSplitterBalance).to.equal(expectedSwapDetails.tokensToFeeSplitter);
          });

          it("Can burn tokens rather than disbursing them", async () => {
            // Swap it to TAU
            await swapHandler
              .connect(keeper)
              .swapForTau(
                testDAI.address,
                testDepositAmount,
                minReturnAmount,
                UNISWAP_SWAP_ADAPTER_HASH,
                PRECISION.div(3),
                basicSwapParams,
              );

            const expectedSwapDetails = swapCalculator(
              PRECISION,
              testDepositAmount,
              GLP_VAULT_PROTOCOL_FEE_VALUE,
              reasonableSlippage,
            );

            // Get total tau burned
            const tauBurned = initTauSupply.sub(await tau.totalSupply());

            // Check that tokens withheld has not increased
            expect(await swapHandler.tauWithheld()).to.equal(tauBurned.mul(PRECISION.div(3)).div(PRECISION));
          });

          it("revert swaps for Tau when the contract is paused", async () => {
            // Pause contract
            await swapHandler.connect(multisigPlaceholder).pause();

            // Swap should fail
            await expect(
              swapHandler
                .connect(keeper)
                .swapForTau(
                  testDAI.address,
                  testDepositAmount,
                  0,
                  UNISWAP_SWAP_ADAPTER_HASH,
                  PRECISION,
                  basicSwapParams,
                ),
            ).to.be.revertedWith("Pausable: paused");
          });

          it("should revert if slippage is greater than encoded slippage", async () => {
            const noSlippageSwapParams = buildUniswapSwapAdapterData(
              [testDAI.address, tau.address],
              [3000],
              testDepositAmount,
              testDepositAmount,
              protocolFee,
            ).swapData;

            // Swap it for TAU
            await expect(
              swapHandler
                .connect(keeper)
                .swapForTau(
                  testDAI.address,
                  testDepositAmount,
                  0,
                  UNISWAP_SWAP_ADAPTER_HASH,
                  PRECISION,
                  noSlippageSwapParams,
                ),
            ).to.be.revertedWith("Too little received"); // Error code inside SwapRouter for slippage being too high
          });

          it("should revert if swap data is greater than swap amount", async () => {
            // Swap it for TAU
            await expect(
              swapHandler
                .connect(keeper)
                .swapForTau(
                  testDAI.address,
                  testDepositAmount.sub(11),
                  0,
                  UNISWAP_SWAP_ADAPTER_HASH,
                  PRECISION,
                  basicSwapParams,
                ),
            ).to.be.revertedWith("STF"); // The swapRouter is attempting to pull tokens from the swapAdapter which the latter doesn't have.
          });

          it("should revert if slippage is greater than contract-provided slippage", async () => {
            // Swap it for TAU
            await expect(
              swapHandler.connect(keeper).swapForTau(
                testDAI.address,
                testDepositAmount,
                testDepositAmount.mul(1000), // arbitrary high number
                UNISWAP_SWAP_ADAPTER_HASH,
                PRECISION,
                basicSwapParams,
              ),
            ).to.be.revertedWithCustomError(swapHandler, "tooMuchSlippage");
          });
        });
      });
    });
  });
});

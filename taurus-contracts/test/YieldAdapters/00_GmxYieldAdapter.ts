import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { deployments, ethers } from "hardhat";

import {
  ARBITRUM_ESGMX_ADDRESS,
  ARBITRUM_FEE_AND_STAKED_GLP_ADDRESS,
  ARBITRUM_FEE_GMX_ADDRESS,
  ARBITRUM_GMX_GOVERNANCE_ADDRESS,
  ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS,
  ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS,
  ARBITRUM_WETH_ADDRESS,
  ARBITRUM_WETH_DISTRIBUTOR_ADDRESS,
  BYTES_BOOL_TRUE,
  DRIP_DURATION,
  KEEPER_ROLE,
  LIQUIDATOR_ROLE,
  MAX_FEE_PERC,
  PRECISION,
  TAURUS_LIQUIDATION_FEE_KEY,
  TEST_TAU_PER_WETH,
  UNISWAP_SWAP_ADAPTER_HASH,
} from "../constants";
import {
  Controller,
  CustomPriceOracle,
  ERC20,
  FeeSplitter,
  GmxYieldAdapter,
  MockVault,
  TAU,
  UniswapSwapAdapter,
} from "../../typechain";
import {
  areCloseEnough,
  getContract,
  getImpersonatedSigner,
  getLiquidationValues,
  getNamedSigners,
  increaseTimeAndMineBlock,
} from "../utils/helpers/testHelpers";
import { mintHelper } from "../utils/helpers/tauHelpers";
import { GmxArtifacts } from "../utils/ImportedArtifacts/GmxArtifacts";
import {
  depositGlpHelper,
  distributeTauRewardsRewardsHelper,
  mintGlpToDeployerHelper,
  mintStakedGlpHelper,
  modifyPositionHelper,
} from "../utils/helpers/vaultHelpers";
import { getRegisteredOracle } from "../utils/helpers/oracleHelpers";
import { Erc20Artifacts } from "../utils/ImportedArtifacts/Erc20Artifacts";
import { buildUniswapSwapAdapterData, calcReasonableSlippage } from "../utils/helpers/swapAdapterHelpers";

describe("GmxYieldAdapter", function () {
  // Signers
  let [deployer, keeper, user, multisigPlaceholder, trustedNode, liquidator]: SignerWithAddress[] = [];
  let gmxGovernance: SignerWithAddress;

  // Taurus smart contracts
  let tau: TAU;
  let controller: Controller;
  let gmxVault: GmxYieldAdapter;

  // GMX smart contracts
  let stakedGlp: TAU;
  let erc20Glp: ERC20;
  let glpOracle: CustomPriceOracle;
  let feeSplitter: FeeSplitter;

  // Other smart contracts
  let weth: ERC20;

  // Some constants
  const INIT_GLP_DEPOSIT = PRECISION;
  const tauBorrowAmount = INIT_GLP_DEPOSIT.mul(3).div(4);
  const liquidationPrice = PRECISION.mul(85).div(100);

  // Fixtures
  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();

    // Get signers
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    keeper = signers.keeper;
    user = signers.user;
    multisigPlaceholder = signers.multisigPlaceholder;
    trustedNode = signers.trustedNode;
    liquidator = signers.liquidator;
    gmxGovernance = await getImpersonatedSigner(ARBITRUM_GMX_GOVERNANCE_ADDRESS);

    gmxVault = (await getContract("GmxYieldAdapter", deployer)) as GmxYieldAdapter;
    controller = (await getContract("Controller", deployer)) as Controller;
    tau = (await getContract("TAU", deployer)) as TAU;
    const glpOracleAddress = await getRegisteredOracle(ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS);
    glpOracle = (await getContract("CustomPriceOracle", trustedNode, glpOracleAddress)) as CustomPriceOracle;
    feeSplitter = (await getContract("FeeSplitter", deployer)) as FeeSplitter;

    stakedGlp = (await ethers.getContractAt("TAU", ARBITRUM_FEE_AND_STAKED_GLP_ADDRESS, deployer)) as TAU;
    erc20Glp = (await ethers.getContractAt("TAU", ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS, deployer)) as TAU;
    weth = (await ethers.getContractAt(Erc20Artifacts.arbitrumWethAbi, ARBITRUM_WETH_ADDRESS, deployer)) as ERC20;

    const rewardRouterV2 = await ethers.getContractAt(
      GmxArtifacts.rewardRouterV2Abi,
      ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS,
      deployer,
    );

    // Mint some GLP to deployer
    await mintGlpToDeployerHelper(rewardRouterV2);
  });

  const depositFixture = deployments.createFixture(async () => {
    await setupFixture();
    // Mint/deposit some GLP to the vault
    await depositGlpHelper(user, INIT_GLP_DEPOSIT, gmxVault, erc20Glp);
  });

  const oracleSetupFixture = deployments.createFixture(async () => {
    await depositFixture();

    // Send an update to the oracle, setting GLP to be worth $1.
    await glpOracle.updatePrice(PRECISION);
  });

  const borrowFixture = deployments.createFixture(async () => {
    await oracleSetupFixture();

    // Take out a loan for initGlpDepositAmount / 2 TAU
    await modifyPositionHelper(user, gmxVault, BigNumber.from(0), tauBorrowAmount, false);
  });

  const liquidateFixture = deployments.createFixture(async () => {
    // Have user borrow
    await borrowFixture();

    // Set GLP price to $0.70. Their collRatio will now be 1.1 and they will be vulnerable to liquidation.
    await glpOracle.updatePrice(liquidationPrice);
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Deployment", async () => {
    it("should be deployed with correct Controller address", async () => {
      expect(await gmxVault.controller()).to.equal(controller.address);
    });

    it("should be deployed with correct GLP address", async () => {
      // Get staked GLP ERC20 wrapper from the GmxYieldAdapter
      const stakedGlpContract = await ethers.getContractAt(
        GmxArtifacts.stakedGlpAbi,
        await gmxVault.collateralToken(),
        deployer,
      );

      // Get staked GLP contract from its wrapper, check that it is correct
      expect(await stakedGlpContract.stakedGlpTracker()).to.equal(await ARBITRUM_FEE_AND_STAKED_GLP_ADDRESS);
    });
  });

  describe("User Functions", async () => {
    describe("Deposit", async () => {
      beforeEach(async () => {
        await depositFixture();
      });

      it("Tracks deposits correctly", async () => {
        // Check that deposit amount is correct
        expect((await gmxVault.userDetails(user.address)).collateral).to.equal(INIT_GLP_DEPOSIT);
      });

      it("Deposits transfer in the correct amount of stakedGLP", async () => {
        expect(await stakedGlp.balanceOf(gmxVault.address)).to.equal(INIT_GLP_DEPOSIT);
      });

      it("Users cannot deposit without sufficient stakedGlp", async () => {
        // Approve stakedGlp
        await erc20Glp.connect(user).approve(gmxVault.address, INIT_GLP_DEPOSIT);

        // Attempt to deposit should fail
        await expect(gmxVault.connect(user).modifyPosition(INIT_GLP_DEPOSIT, 0, true, false)).to.be.revertedWith(
          "RewardTracker: _amount exceeds stakedAmount",
        );
      });

      it("Users cannot deposit without approving stakedGlp", async () => {
        // Mint stakedGlp to user
        await mintStakedGlpHelper(user, INIT_GLP_DEPOSIT, erc20Glp);

        // Attempt to deposit without approval should fail
        await expect(gmxVault.connect(user).modifyPosition(INIT_GLP_DEPOSIT, 0, true, false)).to.be.revertedWith(
          "StakedGlp: transfer amount exceeds allowance",
        );
      });
    });

    describe("Withdraw", async () => {
      beforeEach(async () => {
        await depositFixture();
      });

      it("Users cannot withdraw more than their collateral balance", async () => {
        // Attempt to withdraw more than collateral should fail
        await expect(
          gmxVault.connect(user).modifyPosition(INIT_GLP_DEPOSIT.add(1), 0, false, false),
        ).to.be.revertedWithCustomError(gmxVault, "insufficientCollateral");
      });

      it("Users cannot withdraw if they have not deposited", async () => {
        // Attempt to withdraw without depositing should fail
        await expect(
          gmxVault.connect(keeper).modifyPosition(INIT_GLP_DEPOSIT, 0, false, false),
        ).to.be.revertedWithCustomError(gmxVault, "insufficientCollateral");
      });

      describe("Successful withdraw", async () => {
        beforeEach(async () => {
          await oracleSetupFixture();
        });

        it("Users can successfully withdraw up to their full balance if they have no debt", async () => {
          // Withdraw should succeed
          await modifyPositionHelper(user, gmxVault, INIT_GLP_DEPOSIT.mul(-1), BigNumber.from(0), true);
          expect((await gmxVault.userDetails(user.address)).collateral).to.equal(0);
        });

        it("Users can successfully withdraw a portion of their balance if they have no debt", async () => {
          // Withdraw should succeed
          await modifyPositionHelper(user, gmxVault, INIT_GLP_DEPOSIT.div(-2), BigNumber.from(0), true);
          expect((await gmxVault.userDetails(user.address)).collateral).to.equal(INIT_GLP_DEPOSIT.div(2));
        });
      });
    });

    describe("Borrow", async () => {
      beforeEach(async () => {
        await borrowFixture();
      });

      it("Borrow should correctly update user info", async () => {
        expect((await gmxVault.userDetails(user.address)).debt).to.equal(tauBorrowAmount);
        expect((await gmxVault.userDetails(user.address)).collateral).to.equal(INIT_GLP_DEPOSIT);
      });

      it("Users cannot withdraw if it would render their account unhealthy", async () => {
        // Attempt to withdraw less than collateral balance, but enough to render account unhealthy, should fail
        await expect(
          gmxVault.connect(user).modifyPosition(0, INIT_GLP_DEPOSIT, false, true),
        ).to.be.revertedWithCustomError(gmxVault, "insufficientCollateral");
      });

      it("Users can close their positions, even when the vault is paused", async () => {
        await gmxVault.connect(multisigPlaceholder).pause();
        await tau.connect(user).approve(gmxVault.address, tauBorrowAmount);
        await gmxVault.connect(user).emergencyClosePosition();

        // Check that everything's been withdrawn
        expect((await gmxVault.userDetails(user.address)).collateral).to.equal(0);
        expect((await gmxVault.userDetails(user.address)).debt).to.equal(0);
        expect(await stakedGlp.balanceOf(user.address)).to.equal(INIT_GLP_DEPOSIT);
        expect(await tau.balanceOf(user.address)).to.equal(0);
      });
    });

    describe("Liquidate", async () => {
      beforeEach(async () => {
        await liquidateFixture();
      });

      it("non-keepers cannot liquidate while liquidatorRoleRequired", async () => {
        await expect(gmxVault.connect(user).liquidate(user.address, 100, 0)).to.be.revertedWithCustomError(
          gmxVault,
          "notLiquidator",
        );
      });

      it("cannot liquidate if the vault is paused", async () => {
        await gmxVault.connect(multisigPlaceholder).pause();
        await expect(gmxVault.connect(liquidator).liquidate(user.address, PRECISION, 0)).to.be.revertedWith(
          "Pausable: paused",
        );
      });

      it("keepers can liquidate if an account is unhealthy", async () => {
        // check if the account is underwater
        const health = await gmxVault.getAccountHealth(user.address);
        expect(health).eq(false);

        // Check the liquidation amount
        const liqAmt = await gmxVault.getMaxLiquidation(user.address);

        const accDetails = await gmxVault.userDetails(user.address);

        const calcLiqParams = await getLiquidationValues(
          accDetails.collateral,
          accDetails.debt,
          liquidationPrice,
          BigNumber.from(18),
        );

        // Mint some TAU to the liquidator and approve vault to spend it
        await mintHelper(liqAmt, liquidator.address);
        await tau.connect(liquidator).approve(gmxVault.address, liqAmt);
        const totalTauSupply = await tau.totalSupply();

        // Should successfully liquidate the account
        expect(await gmxVault.connect(liquidator).liquidate(user.address, liqAmt, 0)).to.emit(
          gmxVault.address,
          "AccountLiquidated",
        );

        // Check user details after liquidation
        const accDetailsPostLiq = await gmxVault.userDetails(user.address);
        expect(accDetailsPostLiq.collateral).eq(calcLiqParams.newCollateralAmount);
        expect(accDetailsPostLiq.debt).eq(calcLiqParams.newDebtAmount);

        // Check the accounts if they have received the necessary tokens after liquidation
        expect(await erc20Glp.balanceOf(liquidator.address)).to.be.eq(calcLiqParams.totalCollateralToLiquidator);
        expect(await erc20Glp.balanceOf(feeSplitter.address)).to.be.eq(calcLiqParams.collToFeeSplitter);

        // Repaid TAU should have been burned
        const tauBurned = totalTauSupply.sub(await tau.totalSupply());
        expect(tauBurned).to.be.eq(accDetails.debt.sub(calcLiqParams.newDebtAmount));
      });

      it("should revert if more than required amount is being liquidated", async () => {
        // check if the account is underwater
        const health = await gmxVault.getAccountHealth(user.address);
        expect(health).eq(false);

        // Check the liquidation amount
        let liqAmt = await gmxVault.getMaxLiquidation(user.address);
        liqAmt = liqAmt.add(PRECISION); // This value is now much too high

        // Mint some TAU to the liquidator and approve vault to spend it
        await mintHelper(liqAmt, liquidator.address);
        await tau.connect(liquidator).approve(gmxVault.address, liqAmt);

        // Should fail to liquidate account because the amount is too high
        await expect(gmxVault.connect(liquidator).liquidate(user.address, liqAmt, 0)).to.be.revertedWithCustomError(
          gmxVault,
          "wrongLiquidationAmount",
        );
      });

      it("keepers cannot liquidate if an account is healthy", async () => {
        await glpOracle.updatePrice(PRECISION.mul(95).div(100));
        // check if the account is underwater
        const health = await gmxVault.getAccountHealth(user.address);
        expect(health).eq(true);

        const accDetailsBeforeLiq = await gmxVault.userDetails(user.address);

        await expect(
          gmxVault.connect(liquidator).liquidate(user.address, BigNumber.from(1), 0),
        ).to.be.revertedWithCustomError(gmxVault, "cannotLiquidateHealthyAccount");

        const accDetailsAfterLiq = await gmxVault.userDetails(user.address);

        expect(accDetailsAfterLiq.collateral).eq(accDetailsBeforeLiq.collateral);
        expect(accDetailsAfterLiq.debt).eq(accDetailsBeforeLiq.debt);
      });

      it("keepers get entire collateral if the debt borrowed is below the collateral value", async () => {
        const newPrice = PRECISION.mul(5).div(100);
        await glpOracle.updatePrice(newPrice);

        // Check the liquidation amount
        const liqAmt = await gmxVault.getMaxLiquidation(user.address);

        const accDetails = await gmxVault.userDetails(user.address);

        const calcLiqParams = await getLiquidationValues(
          accDetails.collateral,
          accDetails.debt,
          newPrice,
          BigNumber.from(18),
        );

        // Mint some TAU to the liquidator and approve vault to spend it
        await mintHelper(liqAmt, liquidator.address);
        await tau.connect(liquidator).approve(gmxVault.address, liqAmt);

        // Should successfully liquidate the account
        expect(await gmxVault.connect(liquidator).liquidate(user.address, liqAmt, 0)).to.emit(
          gmxVault.address,
          "AccountLiquidated",
        );

        // Check user details after liquidation
        const accDetailsPostLiq = await gmxVault.userDetails(user.address);
        expect(accDetailsPostLiq.collateral).eq(0);
        expect(accDetailsPostLiq.debt).eq(0);

        // Check the accounts if they have received the necessary tokens after liquidation
        expect(await erc20Glp.balanceOf(liquidator.address)).to.be.eq(calcLiqParams.totalCollateralToLiquidator);
        expect(await erc20Glp.balanceOf(feeSplitter.address)).to.be.eq(calcLiqParams.collToFeeSplitter);
      });

      it("non-keepers can liquidate once liquidator role is deactivated", async () => {
        // Deactivate liquidator role
        await controller.connect(multisigPlaceholder).grantRole(LIQUIDATOR_ROLE, ethers.constants.AddressZero);
        const health = await gmxVault.getAccountHealth(user.address);
        expect(health).eq(false);

        // Check the liquidation amount
        const liqAmt = await gmxVault.getMaxLiquidation(user.address);

        const accDetails = await gmxVault.userDetails(user.address);

        const calcLiqParams = await getLiquidationValues(
          accDetails.collateral,
          accDetails.debt,
          liquidationPrice,
          BigNumber.from(18),
        );

        // Mint some TAU to the liquidator and approve vault to spend it
        await mintHelper(liqAmt, liquidator.address);
        await tau.connect(liquidator).approve(gmxVault.address, liqAmt);

        // Should successfully liquidate the account
        expect(await gmxVault.connect(liquidator).liquidate(user.address, liqAmt, 0))
          .to.emit(gmxVault.address, "AccountLiquidated")
          .withArgs(liquidator.address, user.address, calcLiqParams.collToLiquidate, calcLiqParams.collToFeeSplitter);
      });

      describe("Earn rewards and Liquidate", async () => {
        const totalTauRewards = PRECISION.div(10);
        const earnRewardsFixture = deployments.createFixture(async () => {
          await liquidateFixture();

          await distributeTauRewardsRewardsHelper(deployer, totalTauRewards, gmxVault, tau);

          // Wait for half of the rewards period to pass
          await increaseTimeAndMineBlock(DRIP_DURATION / 2);
        });

        beforeEach(async () => {
          await earnRewardsFixture();
        });

        it("account should be liquidated after accruing interest on the collateral", async () => {
          await glpOracle.updatePrice(PRECISION);
          const accDetails1 = await gmxVault.userDetails(user.address);

          // Let's distribute the rewards
          await modifyPositionHelper(user, gmxVault, ethers.utils.parseEther("0.1").mul(-1), BigNumber.from(0), true);
          const accDetails2 = await gmxVault.userDetails(user.address);

          const newPrice = PRECISION.mul(85).div(100);
          await glpOracle.updatePrice(newPrice);
          await glpOracle.currentPrice();

          expect(accDetails2.collateral).eq(accDetails1.collateral.sub(ethers.utils.parseEther("0.1")));
          expect(accDetails2.debt).lt(accDetails1.debt);

          // Check if the account is underwater
          const uw1 = await gmxVault.getAccountHealth(user.address);
          expect(uw1).eq(false);
          // Check the liquidation amount
          let liqAmt = await gmxVault.getMaxLiquidation(user.address);
          liqAmt = liqAmt.sub(PRECISION.div(100));

          const calcLiqParams = await getLiquidationValues(
            accDetails2.collateral,
            accDetails2.debt,
            newPrice,
            BigNumber.from(18),
          );

          // Mint some TAU to the liquidator and approve vault to spend it
          await mintHelper(liqAmt, liquidator.address);
          await tau.connect(liquidator).approve(gmxVault.address, liqAmt);

          // Should successfully liquidate the account
          expect(await gmxVault.connect(liquidator).liquidate(user.address, liqAmt, 0))
            .to.emit(gmxVault.address, "AccountLiquidated")
            .withArgs(liquidator.address, user.address, calcLiqParams.collToLiquidate, calcLiqParams.collToFeeSplitter);

          // Check user details after liquidation
          const accDetailsPostLiq = await gmxVault.userDetails(user.address);
          areCloseEnough(accDetailsPostLiq.collateral, calcLiqParams.newCollateralAmount, PRECISION.div(1000));
          areCloseEnough(accDetailsPostLiq.debt, calcLiqParams.newDebtAmount, PRECISION.div(1000));
        });
      });
    });

    describe("Oracle", async () => {
      it("Before Oracle is set up, getAccountHealth will revert", async () => {
        await expect(gmxVault.getAccountHealth(user.address)).to.be.revertedWithCustomError(gmxVault, "oracleCorrupt");
      });

      describe("Oracle setup", async () => {
        beforeEach(async () => {
          await oracleSetupFixture();

          it("Oracle has the correct price", async () => {
            expect(await glpOracle.getLatestPrice(BYTES_BOOL_TRUE)).to.equal(PRECISION);
          });

          it("Oracle is active", async () => {
            await gmxVault.getAccountHealth(user.address); // This just needs to not revert.
          });
        });
      });
    });

    describe("Repay Debt", async () => {
      let initUserGlpAmount: BigNumber;
      let initUserTauAmount: BigNumber;
      let initTauSupply: BigNumber;

      const repayDebtFixture = deployments.createFixture(async () => {
        await borrowFixture();
        initUserGlpAmount = await erc20Glp.balanceOf(user.address);
        initUserTauAmount = await tau.balanceOf(user.address);
        initTauSupply = await tau.totalSupply();
        await tau.connect(user).approve(gmxVault.address, tauBorrowAmount);
      });

      beforeEach(async () => {
        await repayDebtFixture();
      });

      it("Users cannot repay more than their debt", async () => {
        // Check init conditions
        expect((await gmxVault.userDetails(user.address)).debt).to.equal(tauBorrowAmount);
        expect(await tau.balanceOf(user.address));

        // Attempt to repay more than debt should only repay existing debt
        await modifyPositionHelper(user, gmxVault, BigNumber.from(0), tauBorrowAmount.mul(-1), true);

        expect((await gmxVault.userDetails(user.address)).debt).to.equal(0);
        expect(await tau.balanceOf(user.address)).to.equal(initUserTauAmount.sub(tauBorrowAmount));
      });

      it("Users can repay some of their debt", async () => {
        const repayAmount = tauBorrowAmount.div(2);
        await modifyPositionHelper(user, gmxVault, BigNumber.from(0), repayAmount.mul(-1), true);
        expect((await gmxVault.userDetails(user.address)).debt).to.equal(repayAmount);
        expect(await tau.balanceOf(user.address)).to.equal(initUserTauAmount.sub(repayAmount));
        expect(await tau.totalSupply()).to.equal(initTauSupply.sub(repayAmount));
      });

      it("Users can close their positions", async () => {
        const userCollateral = (await gmxVault.userDetails(user.address)).collateral;
        await modifyPositionHelper(user, gmxVault, userCollateral.mul(-1), ethers.constants.MinInt256, true);

        const newUserDetails = await gmxVault.userDetails(user.address);
        expect(newUserDetails.debt).to.equal(0);
        expect(newUserDetails.collateral).to.equal(0);
        expect(await tau.balanceOf(user.address)).to.equal(initUserTauAmount.sub(tauBorrowAmount));
        expect(await erc20Glp.balanceOf(user.address)).to.equal(initUserGlpAmount.add(INIT_GLP_DEPOSIT));
      });
    });

    describe("Reward tracking", async () => {
      const totalTauRewards = PRECISION.mul(1000);
      const earnRewardsFixture = deployments.createFixture(async () => {
        await borrowFixture();

        await distributeTauRewardsRewardsHelper(deployer, totalTauRewards, gmxVault, tau);

        // Wait for half of the rewards period to pass
        await increaseTimeAndMineBlock(DRIP_DURATION / 2);
      });

      beforeEach(async () => {
        await earnRewardsFixture();
      });
    });
  });

  describe("Multisig Functions", async () => {
    it("Add a fee to the contract", async () => {
      await gmxVault.connect(multisigPlaceholder).addFeePerc([ethers.constants.HashZero], [15]);

      const liqFeeVal = await gmxVault.getFeePerc(ethers.constants.HashZero);

      expect(liqFeeVal).eq(15);
    });

    it("should revert if the fee is > 20%", async () => {
      // Attempt to add a fee of 20% should work fine
      await gmxVault.connect(multisigPlaceholder).addFeePerc([TAURUS_LIQUIDATION_FEE_KEY], [MAX_FEE_PERC]);
      // Anything higher should revert
      await expect(
        gmxVault.connect(multisigPlaceholder).addFeePerc([TAURUS_LIQUIDATION_FEE_KEY], [MAX_FEE_PERC.add(1)]),
      ).to.be.revertedWithCustomError(gmxVault, "feePercTooLarge");
    });
  });

  describe("Pausable", async () => {
    const pausableFixture = deployments.createFixture(async () => {
      await setupFixture();
      expect(await gmxVault.connect(multisigPlaceholder).pause()).to.emit(gmxVault, "Paused");
    });

    beforeEach(async () => {
      await pausableFixture();
    });

    it("revert distributeTauRewards() when contract is paused", async () => {
      await expect(gmxVault.distributeTauRewards(PRECISION)).to.be.revertedWith("Pausable: paused");
    });

    it("revert disburseTau() when contract is paused", async () => {
      await expect(gmxVault.disburseTau()).to.be.revertedWith("Pausable: paused");
    });

    it("cannot modify position if the vault is paused", async () => {
      await expect(gmxVault.modifyPosition(PRECISION, PRECISION, true, false)).to.be.revertedWith("Pausable: paused");
    });

    it("cannot pause already paused vault", async () => {
      await expect(gmxVault.connect(multisigPlaceholder).pause()).to.be.revertedWith("Pausable: paused");
    });

    it("cannot unpause already unpaused vault", async () => {
      await expect(gmxVault.connect(multisigPlaceholder).unpause()).to.emit(gmxVault, "Unpaused");
      await expect(gmxVault.connect(multisigPlaceholder).unpause()).to.revertedWith("Pausable: not paused");
    });

    it("only multisig can pause/unpause the vault", async () => {
      await expect(gmxVault.unpause()).to.be.revertedWithCustomError(gmxVault, "notMultisig");
      await expect(gmxVault.connect(multisigPlaceholder).unpause()).to.emit(gmxVault, "Unpaused");
      await expect(gmxVault.pause()).to.be.revertedWithCustomError(gmxVault, "notMultisig");
      await expect(gmxVault.connect(multisigPlaceholder).pause()).to.emit(gmxVault, "Paused");
    });
  });

  describe("Upgradeable", async () => {
    let newVaultLogic: GmxYieldAdapter;
    const deployNewLogicFixture = async () => {
      await setupFixture();
      const vaultFactory = await ethers.getContractFactory("MockVault");
      newVaultLogic = (await vaultFactory.deploy()) as GmxYieldAdapter;
    };

    beforeEach(async () => {
      await deployNewLogicFixture();
    });

    it("non-governor cannot upgrade", async () => {
      await expect(gmxVault.upgradeTo(gmxVault.address)).to.be.revertedWithCustomError(gmxVault, "notGovernance");
    });

    it("Governor can upgrade", async () => {
      await gmxVault.connect(multisigPlaceholder).upgradeTo(newVaultLogic.address);
      const newVault = (await ethers.getContractAt("MockVault", gmxVault.address)) as MockVault;

      // Vault can now use MockVault functions
      await newVault.populateUsers([user.address], [100], [200]);
      const newUserDetails = await newVault.userDetails(user.address);
      expect(newUserDetails.collateral).to.equal(100);
      expect(newUserDetails.debt).to.equal(200);
    });
  });

  describe("Full integration", async () => {
    let wethBalBefore: BigNumber;
    let glpSupply: BigNumber;

    let esGmx: ERC20;

    const claimYieldFixture = deployments.createFixture(async () => {
      await borrowFixture();
      esGmx = (await ethers.getContractAt("ERC20", ARBITRUM_ESGMX_ADDRESS, deployer)) as ERC20;

      glpSupply = await erc20Glp.totalSupply();

      wethBalBefore = await weth.balanceOf(ARBITRUM_WETH_DISTRIBUTOR_ADDRESS);
    });

    beforeEach(async () => {
      await claimYieldFixture();
    });

    it("Anyone can claim yield", async () => {
      expect(await weth.balanceOf(gmxVault.address)).to.eq(0);
      expect(await esGmx.balanceOf(gmxVault.address)).to.eq(0);
      // The initial yield claim will collect WETH from feeGlp and stake esGmx from stakedGlp, if any
      await increaseTimeAndMineBlock(86400 * 365 * 10000);
      await gmxVault.collectYield();
      expect(await weth.balanceOf(gmxVault.address)).to.be.gt(0);

      // esGmx should not have been withdrawn
      expect(await esGmx.balanceOf(gmxVault.address)).to.be.eq(0);
    });

    it("Has full functionality", async () => {
      // Set up a user
      await borrowFixture();

      // Set up swap adapter and keeper
      const swapAdapter = (await getContract("UniswapSwapAdapter", deployer)) as UniswapSwapAdapter;
      await controller.connect(multisigPlaceholder).grantRole(KEEPER_ROLE, keeper.address);
      await controller.connect(multisigPlaceholder).registerSwapAdapter(UNISWAP_SWAP_ADAPTER_HASH, swapAdapter.address);
      await swapAdapter.approveTokens(weth.address);

      // Claim yield from Gmx
      await increaseTimeAndMineBlock(86400);
      await gmxVault.collectYield();

      // Swap yield for Tau
      const wethBalance = await weth.balanceOf(gmxVault.address);
      const minTauReturned = calcReasonableSlippage(wethBalance, TEST_TAU_PER_WETH);
      const swapData = buildUniswapSwapAdapterData([weth.address, tau.address], [3000], wethBalance, minTauReturned);

      const userDebtBefore = (await gmxVault.userDetails(user.address)).debt;

      await gmxVault
        .connect(keeper)
        .swapForTau(weth.address, wethBalance, minTauReturned, UNISWAP_SWAP_ADAPTER_HASH, PRECISION, swapData.swapData);

      // User's tau should now be repaid
      await gmxVault.updateRewards(user.address);
      const userDebtAfter = (await gmxVault.userDetails(user.address)).debt;
      expect(userDebtAfter).to.be.lt(userDebtBefore);

      // FeeSplitter should have received some weth
      expect(await weth.balanceOf(feeSplitter.address)).to.be.greaterThan(0);
    });
  });
});

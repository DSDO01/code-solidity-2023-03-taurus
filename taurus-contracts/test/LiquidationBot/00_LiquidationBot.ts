import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { deployments, ethers } from "hardhat";
import { Controller, CustomPriceOracle, ERC20, FeeSplitter, LiquidationBot, MockVault, TAU } from "typechain";

import { mintGlpToDeployerHelper } from "../utils/helpers/vaultHelpers";
import { GmxArtifacts } from "../utils/ImportedArtifacts/GmxArtifacts";
import {
  ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS,
  ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS,
  KEEPER_ROLE,
  LIQUIDATOR_ROLE,
  PERCENT_PRECISION,
  PRECISION,
  TAURUS_LIQUIDATION_FEE_KEY,
} from "../constants";
import { populateAccounts } from "../utils/helpers/liquidationBotHelpers";
import { getRegisteredOracle } from "../utils/helpers/oracleHelpers";
import { getContract, getLiquidationValues, getNamedSigners } from "../utils/helpers/testHelpers";
import { mintHelper } from "../utils/helpers/tauHelpers";

describe("Liquidation Bot", function () {
  let [deployer, multisigPlaceholder, trustedNode, keeper]: SignerWithAddress[] = [];
  let tau: TAU;
  let controller: Controller;
  let liquidationContract: LiquidationBot;
  let glpOracle: CustomPriceOracle;
  let baseVault: MockVault;
  let erc20Glp: ERC20;
  let rewardRouterV2: Contract;
  let feeSplitter: FeeSplitter;

  const liqFeePerc = PERCENT_PRECISION.div(20);

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();

    const signers = await getNamedSigners();
    deployer = signers.deployer;
    multisigPlaceholder = signers.multisigPlaceholder;
    trustedNode = signers.trustedNode;
    keeper = signers.keeper; // In prod, this will be OZ defender address

    const glpOracleAddress = await getRegisteredOracle(ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS);

    tau = (await getContract("TAU", deployer)) as TAU;
    controller = (await getContract("Controller", multisigPlaceholder)) as Controller;
    await controller.grantRole(KEEPER_ROLE, keeper.address);

    glpOracle = (await getContract("CustomPriceOracle", trustedNode, glpOracleAddress)) as CustomPriceOracle;
    liquidationContract = (await getContract("LiquidationBot", deployer)) as LiquidationBot;

    rewardRouterV2 = await ethers.getContractAt(
      GmxArtifacts.rewardRouterV2Abi,
      ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS,
      deployer,
    );

    erc20Glp = (await ethers.getContractAt("TAU", ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS, deployer)) as TAU;

    baseVault = (await getContract("MockVault", deployer)) as MockVault;

    await glpOracle.updatePrice(PRECISION);
  });

  const setupAccounts = deployments.createFixture(async () => {
    await setupFixture();
    const listDetails = await populateAccounts(100, 30);
    await baseVault.populateUsers(listDetails.accAddress, listDetails.collAmt, listDetails.debtAmt);
  });

  const liquidationFixture = deployments.createFixture(async () => {
    // Transfer some tokens to vault
    await mintGlpToDeployerHelper(rewardRouterV2);
    await erc20Glp.transfer(baseVault.address, PRECISION.mul(1000));
    await mintHelper(PRECISION.mul(1000), liquidationContract.address);

    // approve tokens for liquidation bot contract
    await liquidationContract.connect(multisigPlaceholder).approveTokens(tau.address, baseVault.address);

    // Add fee structure
    feeSplitter = (await getContract("FeeSplitter", deployer)) as FeeSplitter;

    await baseVault.connect(multisigPlaceholder).addFeePerc([TAURUS_LIQUIDATION_FEE_KEY], [liqFeePerc]);

    // grant keeper role to liquidation bot
    await controller.grantRole(LIQUIDATOR_ROLE, liquidationContract.address);
  });

  beforeEach(async function () {
    await setupAccounts();
  });

  it("revert if set the perc offset more than 10%", async () => {
    await expect(liquidationContract.connect(multisigPlaceholder).setOffsetPercentage(1001))
      .to.be.revertedWithCustomError(liquidationContract, "wrongOffset")
      .withArgs(1001);
  });

  describe("Fetch accounts", async () => {
    it("fetch liquidateable 10 accounts successfully when the users count is 100", async () => {
      const liqAccAddr = await liquidationContract.fetchUnhealthyAccounts(0, baseVault.address);
      expect(liqAccAddr.length).eq(10);
    });

    it("fetch liquidateable 30 accounts successfully when the users count is 100", async () => {
      // increase offset multiple
      await liquidationContract.connect(multisigPlaceholder).setParams(50);

      const liqAccAddr = await liquidationContract.fetchUnhealthyAccounts(0, baseVault.address);
      expect(liqAccAddr.length).eq(30);
    });

    it("should revert if try to fetch the accounts more than actual", async () => {
      await expect(liquidationContract.fetchUnhealthyAccounts(91, baseVault.address)).to.be.revertedWithCustomError(
        baseVault,
        "indexOutOfBound",
      );
      await expect(baseVault.getUsersDetailsInRange(91, 101)).to.be.revertedWithCustomError(
        baseVault,
        "indexOutOfBound",
      );
    });

    it("fetch user details of 10 users successfully when the users count is 100", async () => {
      const liqAccAddr = await baseVault.getUsersDetailsInRange(91, 100);
      expect(liqAccAddr.length).eq(10);
    });
  });

  describe("Liquidate accounts", async () => {
    beforeEach(async () => {
      await liquidationFixture();
    });

    it("should liquidate the first account fetched", async () => {
      const liqAccAddr = await liquidationContract.fetchUnhealthyAccounts(0, baseVault.address);
      expect(liqAccAddr.length).eq(10);

      // try to liquidate one of the accounts
      const health = await baseVault.getAccountHealth(liqAccAddr[0]);
      expect(health).eq(false);

      const liqAmt = await baseVault.getMaxLiquidation(liqAccAddr[0]);
      const accDetails = await baseVault.userDetails(liqAccAddr[0]);

      const totalTauSupply = await tau.totalSupply();

      const calcLiqParams = getLiquidationValues(accDetails.collateral, accDetails.debt, PRECISION, BigNumber.from(18));

      // Should successfully liquidate the account
      expect(
        await liquidationContract.connect(keeper).liquidate({
          vaultAddress: baseVault.address,
          accountAddr: liqAccAddr[0],
          amount: liqAmt,
          offset: false,
        }),
      )
        .to.emit(baseVault.address, "AccountLiquidated")
        .withArgs(
          liquidationContract.address,
          liqAccAddr[0],
          calcLiqParams.newCollateralAmount,
          calcLiqParams.collToFeeSplitter,
        );

      // Check user details after liquidation
      const accDetailsPostLiq = await baseVault.userDetails(liqAccAddr[0]);
      expect(accDetailsPostLiq.collateral).eq(calcLiqParams.newCollateralAmount);
      expect(accDetailsPostLiq.debt).eq(calcLiqParams.newDebtAmount);

      // Check the accounts if they have received the necessary tokens after liquidation
      expect(await erc20Glp.balanceOf(liquidationContract.address)).to.be.eq(calcLiqParams.totalCollateralToLiquidator);
      expect(await erc20Glp.balanceOf(feeSplitter.address)).to.be.eq(calcLiqParams.collToFeeSplitter);

      // Repaid TAU should have been burned
      const tauBurned = totalTauSupply.sub(await tau.totalSupply());
      expect(tauBurned).to.be.eq(accDetails.debt.sub(calcLiqParams.newDebtAmount));
    });
  });

  describe("Withdraw from Liquidation Bot", async () => {
    beforeEach(async () => {
      await liquidationFixture();
    });

    it("take rewards earned back to multisig account", async () => {
      const liqAccAddr = await liquidationContract.fetchUnhealthyAccounts(0, baseVault.address);

      const liqAmt = await baseVault.getMaxLiquidation(liqAccAddr[0]);
      const accDetails = await baseVault.userDetails(liqAccAddr[0]);

      const totalSupply = await tau.totalSupply();

      const calcLiqParams = getLiquidationValues(accDetails.collateral, accDetails.debt, PRECISION, BigNumber.from(18));

      // Should successfully liquidate the account
      expect(
        await liquidationContract.connect(keeper).liquidate({
          vaultAddress: baseVault.address,
          accountAddr: liqAccAddr[0],
          amount: liqAmt,
          offset: false,
        }),
      )
        .to.emit(baseVault.address, "AccountLiquidated")
        .withArgs(
          liquidationContract.address,
          liqAccAddr[0],
          calcLiqParams.collToLiquidate,
          calcLiqParams.collToFeeSplitter,
        );

      // Get the collateral rewards to the multisig wallet
      const withdrawRewards = calcLiqParams.totalCollateralToLiquidator;
      expect(
        await liquidationContract.connect(multisigPlaceholder).withdrawLiqRewards(erc20Glp.address, withdrawRewards),
      )
        .to.emit(liquidationContract.address, "CollateralWithdrawn")
        .withArgs(multisigPlaceholder.address, withdrawRewards);

      expect(await erc20Glp.balanceOf(multisigPlaceholder.address)).to.be.eq(withdrawRewards);
      // liquidation bot sholuld have 0 collateral token
      expect(await erc20Glp.balanceOf(liquidationContract.address)).to.be.eq(0);
      expect(await tau.totalSupply()).to.be.eq(totalSupply.sub(liqAmt));
    });
  });
});

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { deployments, ethers } from "hardhat";
import { Controller, TAU, TauDripFeed } from "typechain";

import {
  distributeTauRewardsRewardsHelper,
  mintGlpToDeployerHelper,
  mintStakedGlpHelper,
  updateContractRewardsHelper,
} from "../utils/helpers/vaultHelpers";
import { ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS, ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS, PRECISION } from "../constants";
import { calcExpectedTauWithheld } from "../utils/helpers/tauDripFeedHelpers";
import { getContract, getNamedSigners, increaseTimeAndMineBlock } from "../utils/helpers/testHelpers";
import { GmxArtifacts } from "../utils/ImportedArtifacts/GmxArtifacts";

// Tests for the TauDripFeed contract
describe("TauDripFeed", function () {
  let [deployer, keeper, user]: SignerWithAddress[] = [];

  // Contracts
  let tau: TAU;
  let tauDripFeed: TauDripFeed;
  let controller: Controller;
  let erc20Glp: TAU;
  let rewardRouterV2: Contract;

  const INIT_TAU_REWARDS = PRECISION.mul(100000); // 100,000
  const KEEPER_TAU_BALANCE = INIT_TAU_REWARDS.mul(2);
  let distributeTauRewardsTimestamp: number;
  let dripDuration: BigNumber;

  const COLLATERAL_DEPOSIT_AMOUNT = PRECISION.mul(5);

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    // Get signers
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    keeper = signers.keeper;
    user = signers.user;

    tau = (await getContract("TAU", deployer)) as TAU;
    controller = (await getContract("Controller", deployer)) as Controller;
    erc20Glp = (await ethers.getContractAt("TAU", ARBITRUM_STAKED_GLP_CONTRACT_ADDRESS, deployer)) as TAU;
    rewardRouterV2 = await ethers.getContractAt(
      GmxArtifacts.rewardRouterV2Abi,
      ARBITRUM_GMX_REWARD_ROUTER_V2_ADDRESS,
      deployer,
    );

    tauDripFeed = (await getContract("MockVault", deployer)) as TauDripFeed;

    // Deposit some TAU into the vault so that there are some rewards to drip
    distributeTauRewardsTimestamp = await distributeTauRewardsRewardsHelper(keeper, INIT_TAU_REWARDS, tauDripFeed, tau);

    // Get other info from tauDripFeed contract
    dripDuration = await tauDripFeed.DRIP_DURATION();

    // Mint GLP to the deployer
    await mintGlpToDeployerHelper(rewardRouterV2);
  });

  beforeEach(async function () {
    await setupFixture();
  });

  it("should be deployed with correct token addresses", async () => {
    expect(await tauDripFeed.tau()).to.equal(tau.address);
    expect(await tauDripFeed.collateralToken()).to.equal(erc20Glp.address);
  });

  describe("tauWithheld and tokensLastDisbursedTimestamp", async () => {
    it("should correctly track tokensWithheld after a distributeTauRewards()", async () => {
      // distributeTauRewards just happened, so we can proceed immediately

      const tokensWithheld = await tauDripFeed.tauWithheld();

      // Time has passed, but no operations have happened since the tokens were deposited, so tokensWithheld should equal the deposit.
      expect(tokensWithheld).to.equal(INIT_TAU_REWARDS);
    });

    it("tauWithheld() and tokensLastDisbursed should not update if there's no collateral", async () => {
      // Move to halfway through the drip duration
      await increaseTimeAndMineBlock(dripDuration.toNumber() / 2);

      // Attempt to update
      await updateContractRewardsHelper(user, tauDripFeed);

      expect(await tauDripFeed.tauWithheld()).to.equal(INIT_TAU_REWARDS);
      expect(await tauDripFeed.tokensLastDisbursedTimestamp()).to.equal(distributeTauRewardsTimestamp);
    });

    it("tauWithheld and tokensLastDisbursed should update if there is collateral", async () => {
      // Transfer in collateral (not through a deposit)
      await mintStakedGlpHelper(user, COLLATERAL_DEPOSIT_AMOUNT, erc20Glp);
      await erc20Glp.connect(user).transfer(tauDripFeed.address, COLLATERAL_DEPOSIT_AMOUNT);

      // Values should not yet be updated
      expect(await tauDripFeed.tauWithheld()).to.equal(INIT_TAU_REWARDS);
      expect(await tauDripFeed.tokensLastDisbursedTimestamp()).to.equal(distributeTauRewardsTimestamp);

      // Update contract rewards
      const updateTimestamp = await updateContractRewardsHelper(user, tauDripFeed);

      // Values should now be updated
      expect(await tauDripFeed.tokensLastDisbursedTimestamp()).to.equal(updateTimestamp);
      const expectedAmountWithheld = await calcExpectedTauWithheld(
        INIT_TAU_REWARDS,
        distributeTauRewardsTimestamp,
        updateTimestamp,
        dripDuration.toNumber(),
      );
      expect(await tauDripFeed.tauWithheld()).to.equal(expectedAmountWithheld);
    });
  });

  describe("distributeTauRewards()", async () => {
    it("should fail if distributeTauRewards attempts to pull more tokens than are approved", async () => {
      await expect(tauDripFeed.connect(keeper).distributeTauRewards(INIT_TAU_REWARDS.add(1))).to.be.revertedWith(
        "ERC20: insufficient allowance",
      );
    });

    it("should fail if distributeTauRewards attempts to pull more tokens than are available", async () => {
      // Approve more TAU to vault
      await tau.connect(keeper).approve(tauDripFeed.address, KEEPER_TAU_BALANCE.add(1));

      // Attempt to distributeTauRewards more TAU than we have
      await expect(tauDripFeed.connect(keeper).distributeTauRewards(KEEPER_TAU_BALANCE.add(1))).to.be.revertedWith(
        "ERC20: burn amount exceeds balance",
      );
    });

    describe("distributeTauRewards called again before first disbursal finishes", async () => {
      const SECOND_DEPOSIT = INIT_TAU_REWARDS.div(3);
      let secondRewardTimestamp: number;
      let tokensWithheldAtSecondDeposit: BigNumber; // The amount of tokens from the first deposit still withheld when the second deposit takes place
      let totalSecondReward: BigNumber; // This represents SECOND_DEPOSIT + the TAU which has not yet been disbursed from the first deposit.

      const doubledistributeTauRewardsFixture = deployments.createFixture(async () => {
        await setupFixture();

        // Get some collateral in
        await mintStakedGlpHelper(user, COLLATERAL_DEPOSIT_AMOUNT, erc20Glp);
        await erc20Glp.connect(user).transfer(tauDripFeed.address, COLLATERAL_DEPOSIT_AMOUNT);

        // Move to halfway through the drip duration
        await increaseTimeAndMineBlock(dripDuration.toNumber() / 2);

        // Deposit TAU again
        secondRewardTimestamp = await distributeTauRewardsRewardsHelper(keeper, SECOND_DEPOSIT, tauDripFeed, tau);

        tokensWithheldAtSecondDeposit = await calcExpectedTauWithheld(
          INIT_TAU_REWARDS,
          distributeTauRewardsTimestamp,
          secondRewardTimestamp,
          dripDuration.toNumber(),
        );

        // Calculate expected totalSecondReward
        totalSecondReward = SECOND_DEPOSIT.add(tokensWithheldAtSecondDeposit);
      });

      beforeEach(async function () {
        await doubledistributeTauRewardsFixture();
      });

      it("should add remaining tokensWithheld to new tokensWithheld upon new disbursal", async () => {
        // Check that new tokensWithheld is what was expected
        expect(await tauDripFeed.tauWithheld()).to.equal(totalSecondReward);
      });

      it("should correctly distribute tokensPerCollateral", async () => {
        const totalDisbursedTau = INIT_TAU_REWARDS.add(SECOND_DEPOSIT).sub(totalSecondReward);
        const expectedCumulativeRewards = totalDisbursedTau.mul(PRECISION).div(COLLATERAL_DEPOSIT_AMOUNT);
        expect(await tauDripFeed.cumulativeTauRewardPerCollateral()).to.equal(expectedCumulativeRewards);
      });
    });
  });
});

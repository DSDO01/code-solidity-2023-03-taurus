import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

import { FeeSplitter, TAU } from "../typechain";

import { PERCENT_PRECISION, PRECISION } from "./constants";
import { getContract, getNamedSigners } from "./utils/helpers/testHelpers";

describe("FeeSplitter", function () {
  let [deployer, multisig, user, keeper]: SignerWithAddress[] = [];
  let feeSplitter: FeeSplitter;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    multisig = signers.multisigPlaceholder;
    user = signers.user;
    keeper = signers.keeper;

    feeSplitter = (await getContract("FeeSplitter", multisig)) as FeeSplitter;
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Deployment tests", async () => {
    // Note that when the FeeSplitter deployment is updated, these tests will also need to be updated.
    it("Initial fee recipients should be set correctly", async () => {
      const firstRecipient = await feeSplitter.feeRecipients(0);
      const secondRecipient = await feeSplitter.feeRecipients(1);
      expect(await feeSplitter.numFeeRecipients()).to.equal(1);
      expect(firstRecipient.recipient).to.equal(multisig.address);
      expect(firstRecipient.proportion).to.equal(PERCENT_PRECISION);
      expect(secondRecipient.recipient).to.equal(ethers.constants.AddressZero);
      expect(secondRecipient.proportion).to.equal(0);
    });
  });

  describe("Set Fee Recipients", async () => {
    it("Multisig cannot delete all recipients", async () => {
      await expect(feeSplitter.setFeeRecipients([], []))
        .to.be.revertedWithCustomError(feeSplitter, "incorrectProportions")
        .withArgs(0);
    });

    it("Multisig can set fee recipients", async () => {
      const deployerRecipient = { recipient: deployer.address, proportion: PERCENT_PRECISION.div(2) };
      const multisigRecipient = { recipient: multisig.address, proportion: PERCENT_PRECISION.div(2) };
      await feeSplitter.setFeeRecipients([deployerRecipient, multisigRecipient]);

      const recipient0 = await feeSplitter.feeRecipients(0);
      const recipient1 = await feeSplitter.feeRecipients(1);
      expect(await feeSplitter.numFeeRecipients()).to.equal(2);
      expect(recipient0.recipient).to.equal(deployerRecipient.recipient);
      expect(recipient0.proportion).to.equal(deployerRecipient.proportion);
      expect(recipient1.recipient).to.equal(multisigRecipient.recipient);
      expect(recipient1.proportion).to.equal(multisigRecipient.proportion);
    });

    it("Multisig cannot set fee recipients with incorect proportions", async () => {
      await expect(
        feeSplitter.setFeeRecipients([{ recipient: deployer.address, proportion: PERCENT_PRECISION.add(1) }]),
      )
        .to.be.revertedWithCustomError(feeSplitter, "incorrectProportions")
        .withArgs(PERCENT_PRECISION.add(1));
    });

    it("Non-multisig cannot edit fee recipients", async () => {
      await expect(feeSplitter.connect(deployer).setFeeRecipients([])).to.be.revertedWithCustomError(
        feeSplitter,
        "notMultisig",
      );
    });
  });

  describe("Distribute fees", async () => {
    const initDaiAmount = PRECISION.mul(100);
    let testDai: TAU;
    const distributeFeesFixture = deployments.createFixture(async () => {
      await setupFixture();

      testDai = (await getContract("TestDAI", deployer)) as TAU;

      await testDai.mint(feeSplitter.address, initDaiAmount);
    });

    beforeEach(async function () {
      await distributeFeesFixture();
    });

    it("Anyone can distribute fees", async () => {
      expect(await testDai.balanceOf(multisig.address)).to.equal(0);
      expect(await testDai.balanceOf(feeSplitter.address)).to.equal(initDaiAmount);
      await feeSplitter.connect(deployer).distributeFees(testDai.address);
      expect(await testDai.balanceOf(multisig.address)).to.equal(initDaiAmount);
      expect(await testDai.balanceOf(feeSplitter.address)).to.equal(0);
    });

    it("Distributes fees correctly to multiple recipients", async () => {
      const recipientData = [
        { recipient: deployer.address, proportion: PERCENT_PRECISION.div(4) },
        { recipient: multisig.address, proportion: PERCENT_PRECISION.div(3) },
        { recipient: user.address, proportion: PERCENT_PRECISION.div(6).add(1) },
        { recipient: keeper.address, proportion: PERCENT_PRECISION.div(4) },
      ];

      const initBalances = [
        await testDai.balanceOf(recipientData[0].recipient),
        await testDai.balanceOf(recipientData[1].recipient),
        await testDai.balanceOf(recipientData[2].recipient),
        await testDai.balanceOf(recipientData[3].recipient),
      ];

      // Set up 4 recipients
      await feeSplitter.setFeeRecipients(recipientData);

      await feeSplitter.connect(user).distributeFees(testDai.address);

      for (let i = 0; i < recipientData.length; i++) {
        const expectedAmount = initDaiAmount.mul(recipientData[i].proportion).div(PERCENT_PRECISION);
        expect(await testDai.balanceOf(recipientData[i].recipient)).to.equal(initBalances[i].add(expectedAmount));
      }
    });
  });
});

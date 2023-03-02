import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments } from "hardhat";

import { TGT } from "../typechain";

import { getLatestCheckpointNum } from "./utils/helpers/tgtHelpers";
import { INIT_TGT_MINT } from "./constants";
import { getContract, getNamedSigners } from "./utils/helpers/testHelpers";

describe("TAU token", function () {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let tgt: TGT;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    user = signers.user;

    tgt = (await getContract("TGT", deployer)) as TGT;
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Deployment tests", async () => {
    it("Should have correct name", async () => {
      expect(await tgt.name()).to.equal("TGT");
    });

    it("Should have correct symbol", async () => {
      expect(await tgt.symbol()).to.equal("TGT");
    });

    it("Should have correct decimals", async () => {
      expect(await tgt.decimals()).to.equal(18);
    });

    it("Should have minted correct amount", async () => {
      expect(await tgt.totalSupply()).to.equal(INIT_TGT_MINT);
      expect(await tgt.balanceOf(deployer.address)).to.equal(INIT_TGT_MINT);
    });
  });

  it("Can burn tokens", async () => {
    const initTotal = await tgt.totalSupply();
    await tgt.burn(1000);
    expect(await tgt.balanceOf(deployer.address)).to.equal(INIT_TGT_MINT.sub(1000));
    expect(await tgt.totalSupply()).to.equal(initTotal.sub(1000));
  });

  describe("Voting", async () => {
    const votingSetup = deployments.createFixture(async () => {
      await setupFixture();
      await tgt.delegate(user.address);
    });

    beforeEach(async function () {
      await votingSetup();
    });

    it("Counts votes", async () => {
      const checkpointData = await tgt.checkpoints(user.address, await getLatestCheckpointNum(user.address));
      expect(checkpointData.votes).to.equal(INIT_TGT_MINT);
    });

    it("Can change delegate", async () => {
      await tgt.delegate(deployer.address);
      const userCheckpointData = await tgt.checkpoints(user.address, await getLatestCheckpointNum(user.address));
      expect(userCheckpointData.votes).to.equal(0);
      const deployerCheckpointData = await tgt.checkpoints(
        deployer.address,
        await getLatestCheckpointNum(deployer.address),
      );
      expect(deployerCheckpointData.votes).to.equal(INIT_TGT_MINT);
    });

    it("Transfers reduce delegated votes", async () => {
      await tgt.transfer(user.address, 1000);
      const userCheckpointData = await tgt.checkpoints(user.address, await getLatestCheckpointNum(user.address));
      expect(userCheckpointData.votes).to.equal(INIT_TGT_MINT.sub(1000));
    });
  });
});

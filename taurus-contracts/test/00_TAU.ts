import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments } from "hardhat";

import { TAU } from "../typechain";

import { getContract, getNamedSigners } from "./utils/helpers/testHelpers";

describe("TAU token", function () {
  let deployer: SignerWithAddress;
  let multisigPlaceholder: SignerWithAddress;
  let vaultPlaceholder: SignerWithAddress;
  let user: SignerWithAddress;

  let tau: TAU;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    multisigPlaceholder = signers.multisigPlaceholder;
    vaultPlaceholder = signers.vaultPlaceholder;
    user = signers.user;

    tau = (await getContract("TAU", deployer)) as TAU;
  });

  beforeEach(async function () {
    await setupFixture();
  });

  it("Can burn tokens", async () => {
    const initTotal = await tau.totalSupply();
    await mintHelper(1000, user.address);
    await tau.connect(user).burn(1000);
    expect(await tau.balanceOf(user.address)).to.equal(0);
    expect(await tau.totalSupply()).to.equal(initTotal);
  });

  describe("Governance tests", async () => {
    it("Should not allow non-governance contracts to set mint amounts", async () => {
      await expect(tau.setMintLimit(multisigPlaceholder.address, 1000)).to.be.revertedWithCustomError(
        tau,
        "notGovernance",
      );
    });

    it("Should allow governance to set mint amounts", async () => {
      await tau.connect(multisigPlaceholder).setMintLimit(multisigPlaceholder.address, 1000);
      expect(await tau.mintLimit(multisigPlaceholder.address)).to.equal(1000);
    });
  });

  describe("Vault mint tests", async () => {
    // Fixture to set vaultPlaceholder's mint limit
    const ERC20SetupFixture = deployments.createFixture(async () => {
      await setupFixture();
      await tau.connect(multisigPlaceholder).setMintLimit(vaultPlaceholder.address, 1000);
    });

    this.beforeEach(async () => {
      await ERC20SetupFixture();
    });

    it("Should not allow unapproved contracts/addresses to mint", async () => {
      await expect(tau.mint(deployer.address, 100))
        .to.be.revertedWithCustomError(tau, "mintLimitExceeded")
        .withArgs(100, 0);
    });

    it("Should not allow vaults to exceed mintLimit", async () => {
      await expect(tau.connect(vaultPlaceholder).mint(vaultPlaceholder.address, 1001))
        .to.be.revertedWithCustomError(tau, "mintLimitExceeded")
        .withArgs(1001, 1000);
    });

    it("Should allow vaults to mint up to mintLimit", async () => {
      const preTestBalance = await tau.balanceOf(deployer.address);
      await tau.connect(vaultPlaceholder).mint(deployer.address, 1000);
      expect((await tau.balanceOf(deployer.address)).sub(preTestBalance)).to.equal(1000);
    });

    it("Should deduct burnt tokens from mintLimit", async () => {
      await tau.connect(vaultPlaceholder).mint(vaultPlaceholder.address, 1000);
      await tau.connect(vaultPlaceholder).burn(1000);
      expect(await tau.mintLimit(vaultPlaceholder.address)).to.equal(1000);
    });
  });

  const mintHelper = async (amount: number, recipient: string) => {
    await tau.connect(multisigPlaceholder).setMintLimit(deployer.address, amount);
    await tau.mint(recipient, amount);
  };
});

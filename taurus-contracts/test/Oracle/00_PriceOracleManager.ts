import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

import { BYTES_BOOL_TRUE, TAU_DECIMALS } from "../constants";
import { CustomOracleWrapper, CustomPriceOracle, PriceOracleManager } from "../../typechain";
import { generateRandomAddress, getContract, getNamedSigners } from "../utils/helpers/testHelpers";

describe("Price Oracle Manager", function () {
  let deployer: SignerWithAddress;
  let trustedNode: SignerWithAddress;
  let customWrapper: CustomOracleWrapper;
  let customOracle: CustomPriceOracle;
  let priceOracleManager: PriceOracleManager;
  let tauAddress: string;

  let randomCustomToken: string;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    trustedNode = signers.trustedNode;

    // Get oracle deployments
    priceOracleManager = (await getContract("PriceOracleManager", deployer)) as PriceOracleManager;
    customWrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;
    customOracle = (await getContract("CustomPriceOracle", deployer)) as CustomPriceOracle;

    // Get other deployments
    tauAddress = (await deployments.get("TAU")).address;

    // Get some random addresses to use for testing
    randomCustomToken = await generateRandomAddress();
  });

  beforeEach(async function () {
    await setupFixture();
  });

  const registerWrapperFixture = deployments.createFixture(async () => {
    await setupFixture();
    await priceOracleManager.setWrapper(randomCustomToken, customWrapper.address);
  });

  const registerOraclesFixture = deployments.createFixture(async () => {
    await registerWrapperFixture();
    // Register oracles with their wrappers
    await customWrapper.addOracle(randomCustomToken, customOracle.address);
  });

  describe("Wrapper registration", async () => {
    beforeEach(async () => {
      await registerWrapperFixture();
    });

    it("Add Wrappers successfully", async function () {
      expect(await priceOracleManager.wrapperAddressMap(randomCustomToken)).to.eq(customWrapper.address);
    });

    it("Can update wrapper", async () => {
      expect(await priceOracleManager.updateWrapper(randomCustomToken, tauAddress));
      expect(await priceOracleManager.wrapperAddressMap(randomCustomToken)).to.eq(tauAddress);
    });

    it("Cannot set a wrapper that's already set", async () => {
      await expect(
        priceOracleManager.setWrapper(randomCustomToken, customWrapper.address),
      ).to.be.revertedWithCustomError(priceOracleManager, "duplicateWrapper");
    });

    it("Cannot update a wrapper that's not yet set", async () => {
      await expect(
        priceOracleManager.updateWrapper(customWrapper.address, customWrapper.address),
      ).to.be.revertedWithCustomError(priceOracleManager, "wrapperNotRegistered");
    });

    it("Cannot register a non-contract wrapper", async () => {
      await expect(priceOracleManager.setWrapper(randomCustomToken, deployer.address)).to.be.revertedWithCustomError(
        priceOracleManager,
        "notContract",
      );
    });
  });

  describe("Fetch prices", async () => {
    beforeEach(async function () {
      await registerOraclesFixture();
    });

    it("Fetch price from custom wrapper", async function () {
      // Update the price for custom oracle
      await customOracle.connect(trustedNode).updatePrice(ethers.utils.parseEther("0.000147"));

      // Fetch price from custom oracle
      const priceVals1 = await priceOracleManager.getExternalPrice(randomCustomToken, BYTES_BOOL_TRUE);
      expect(priceVals1.price).eq(ethers.utils.parseEther("0.000147"));
      expect(priceVals1.decimals).eq(TAU_DECIMALS);
    });
  });
});

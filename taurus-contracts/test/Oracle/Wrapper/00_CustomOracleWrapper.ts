import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

import { ARBITRUM_GLP_ADDRESS, BYTES_BOOL_TRUE, GLP_PRICE_DECIMALS } from "../../constants";
import { CustomOracleWrapper, CustomPriceOracle, TAU } from "../../../typechain";
import { getContract, getNamedSigners } from "../../utils/helpers/testHelpers";

describe("Custom Oracle Wrapper", function () {
  let deployer: SignerWithAddress;
  let trustedNode: SignerWithAddress;
  let oracle: CustomPriceOracle;
  let wrapper: CustomOracleWrapper;
  let tau: TAU;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    trustedNode = signers.trustedNode;

    oracle = (await getContract("CustomPriceOracle", deployer)) as CustomPriceOracle;
    wrapper = (await getContract("CustomOracleWrapper", deployer)) as CustomOracleWrapper;
    tau = (await getContract("TAU", deployer)) as TAU;
  });

  this.beforeEach(async function () {
    await setupFixture();
  });

  describe("Custom Oracle Wrapper tests", async () => {
    it("Add oracle successfully", async function () {
      const customOracle = await oracle.connect(trustedNode);

      // First set the price
      await customOracle.updatePrice(ethers.utils.parseEther("0.0001"));

      // Now add the oracle to the wrapper
      expect(await wrapper.addOracle(tau.address, customOracle.address))
        .to.emit(wrapper.address, "NewOracle")
        .withArgs(customOracle.address, tau.address);
    });

    it("Fetch the price and get saved response", async function () {
      const customOracle = await oracle.connect(trustedNode);
      // First set the price
      await customOracle.updatePrice(ethers.utils.parseEther("0.0001"));

      // Now add the oracle tot he wrapper
      expect(await wrapper.addOracle(tau.address, customOracle.address))
        .to.emit(wrapper.address, "NewOracle")
        .withArgs(customOracle.address, tau.address);

      const savedResp = await wrapper.getExternalPrice(tau.address, BYTES_BOOL_TRUE);

      const priceFromOracle = await customOracle.getLatestPrice(BYTES_BOOL_TRUE);

      expect(priceFromOracle._currentPrice).eq(savedResp.price);
      expect(priceFromOracle._decimals).eq(savedResp.decimals);
    });

    it("unable to update the price from oracle", async function () {
      expect(await wrapper.addOracle(tau.address, oracle.address))
        .to.emit(wrapper.address, "NewOracle")
        .withArgs(oracle.address, tau.address);

      const savedResp = await wrapper.getExternalPrice(tau.address, BYTES_BOOL_TRUE);

      expect(savedResp.success).eq(false);
    });

    it("fetch price from externalPrice", async function () {
      const customOracle = await oracle.connect(trustedNode);
      // First set the price
      await customOracle.updatePrice(ethers.utils.parseEther("0.0001"));

      // Now add the oracle tot he wrapper
      expect(await wrapper.addOracle(tau.address, customOracle.address))
        .to.emit(wrapper.address, "NewOracle")
        .withArgs(customOracle.address, tau.address);

      const extResp = await wrapper.getExternalPrice(tau.address, BYTES_BOOL_TRUE);

      const priceFromOracle = await customOracle.getLatestPrice(BYTES_BOOL_TRUE);

      expect(priceFromOracle._currentPrice).eq(extResp.price);
      expect(priceFromOracle._decimals).eq(extResp.decimals);
    });

    it("fetch glp price from custom oracle wrapper", async () => {
      const price = await wrapper.getExternalPrice(ARBITRUM_GLP_ADDRESS, BYTES_BOOL_TRUE);
      expect(price.decimals).eq(GLP_PRICE_DECIMALS);
    });
  });
});

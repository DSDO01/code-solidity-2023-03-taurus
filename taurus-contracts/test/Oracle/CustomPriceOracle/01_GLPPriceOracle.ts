import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments } from "hardhat";

import { BYTES_BOOL_FALSE, BYTES_BOOL_TRUE, GLP_PRICE_DECIMALS } from "../../constants";
import { GLPPriceOracle } from "../../../typechain";
import { getContract, getNamedSigners } from "../../utils/helpers/testHelpers";

describe("GLP Price Oracle", function () {
  let deployer: SignerWithAddress;
  let glpOracle: GLPPriceOracle;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();

    deployer = signers.deployer;

    glpOracle = (await getContract("GLPPriceOracle", deployer)) as GLPPriceOracle;
  });

  this.beforeEach(async () => {
    await setupFixture();
  });

  describe("GLP Price Oracle tests", async () => {
    it("fetch max glp price", async () => {
      const price = await glpOracle.getLatestPrice(BYTES_BOOL_TRUE);
      expect(price._decimals).eq(GLP_PRICE_DECIMALS);
    });

    it("fetch min glp price", async () => {
      const price = await glpOracle.getLatestPrice(BYTES_BOOL_FALSE);
      expect(price._decimals).eq(GLP_PRICE_DECIMALS);
    });

    it("fetch decimals from the glp oracle", async () => {
      const decimals = await glpOracle.decimals();
      expect(decimals).eq(GLP_PRICE_DECIMALS);
    });
  });
});

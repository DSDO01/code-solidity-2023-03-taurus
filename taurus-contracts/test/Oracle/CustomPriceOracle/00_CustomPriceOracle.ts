import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

import { BYTES_BOOL_TRUE, TAU_DECIMALS } from "../../constants";
import { CustomPriceOracle } from "../../../typechain";
import { getContract, getNamedSigners } from "../../utils/helpers/testHelpers";

describe("Custom Price Oracle", function () {
  let deployer: SignerWithAddress;
  let trustedNode: SignerWithAddress;
  let oracle: CustomPriceOracle;

  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();
    const signers = await getNamedSigners();
    deployer = signers.deployer;
    trustedNode = signers.trustedNode;

    oracle = (await getContract("CustomPriceOracle", deployer)) as CustomPriceOracle;
  });

  this.beforeEach(async function () {
    await setupFixture();
  });

  describe("Custom Price Oracle Tests", async () => {
    it("Set the trusted node", async function () {
      // Register trusted node
      await oracle.registerTrustedNode(trustedNode.address);

      // check if the node is registered
      const val1 = await oracle.isTrustedNode(trustedNode.address);
      expect(val1).eq(true);
    });

    it("Update the price feed", async function () {
      const customOracleTrustedNode = await oracle.connect(trustedNode);

      await oracle.registerTrustedNode(trustedNode.address);

      // now update the price feed
      await customOracleTrustedNode.updatePrice(ethers.utils.parseEther("123"));

      const resp = await oracle.getLatestPrice(BYTES_BOOL_TRUE);
      expect(resp._currentPrice).eq(ethers.utils.parseEther("123"));
      expect(resp._decimals).eq(TAU_DECIMALS);
    });

    it("Unregister the trusted node", async function () {
      // Register trusted node
      await oracle.registerTrustedNode(trustedNode.address);

      // check if the node is registered
      const val1 = await oracle.isTrustedNode(trustedNode.address);
      expect(val1).eq(true);

      // Now, unregister the node

      await oracle.unregisterTrustedNode(trustedNode.address);

      const val2 = await oracle.isTrustedNode(trustedNode.address);
      expect(val2).eq(false);
    });
  });
});

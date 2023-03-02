import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";

import { Controller, TAU } from "../typechain";

import { GOVERNANCE_ROLE, KEEPER_ROLE, UNISWAP_SWAP_ADAPTER_HASH } from "./constants";
import { generateRandomAddress, getContract, getNamedSigners } from "./utils/helpers/testHelpers";

// Controller tests. More will be added as Controller functionality is built.
describe("Controller", function () {
  let [deployer, multisigPlaceholder, vaultPlaceholder, swapAdapterPlaceholder, keeper]: SignerWithAddress[] = [];
  let tau: TAU;
  let controller: Controller;
  const setupFixture = deployments.createFixture(async () => {
    await deployments.fixture();

    // Get signers
    const namedSigners = await getNamedSigners();
    deployer = namedSigners.deployer;
    multisigPlaceholder = namedSigners.multisigPlaceholder;
    multisigPlaceholder = namedSigners.multisigPlaceholder;
    vaultPlaceholder = namedSigners.vaultPlaceholder;
    swapAdapterPlaceholder = namedSigners.swapAdapterPlaceholder;
    keeper = namedSigners.keeper;

    controller = (await getContract("Controller", deployer)) as Controller;
    tau = (await getContract("TAU", deployer)) as TAU;
  });

  beforeEach(async function () {
    await setupFixture();
  });

  describe("Deployment", async () => {
    it("should have correct TAU address", async () => {
      expect(await controller.tau()).to.equal(tau.address);
    });

    it("should have correct TGT address", async () => {
      expect(await controller.tgt()).to.equal((await getContract("TGT", deployer)).address);
    });

    it("should have correct governance address", async () => {
      // Using second signer for now, but this will be updated when the governance module is built
      expect(await controller.hasRole(ethers.constants.HashZero, multisigPlaceholder.address)).to.be.true;
    });
  });

  describe("AccessControl", async () => {
    describe("Governance role", async () => {
      it("non-governor cannot transfer governance", async () => {
        await expect(controller.grantRole(GOVERNANCE_ROLE, ethers.constants.AddressZero)).to.be.revertedWith(
          "AccessControl: account " + deployer.address.toLocaleLowerCase() + " is missing role " + GOVERNANCE_ROLE,
        );
      });

      it("governor can transfer governance", async () => {
        await controller.connect(multisigPlaceholder).grantRole(GOVERNANCE_ROLE, vaultPlaceholder.address);
        await controller.connect(multisigPlaceholder).renounceRole(GOVERNANCE_ROLE, multisigPlaceholder.address);
        expect(await controller.hasRole(ethers.constants.HashZero, vaultPlaceholder.address)).to.be.true;
        expect(await controller.hasRole(ethers.constants.HashZero, multisigPlaceholder.address)).to.be.false;
      });

      it("governor can transfer keeper", async () => {
        await controller.connect(multisigPlaceholder).grantRole(KEEPER_ROLE, multisigPlaceholder.address);
        expect(await controller.hasRole(KEEPER_ROLE, multisigPlaceholder.address)).to.be.true;
      });
    });

    describe("Keeper role", async () => {
      it("multisig can register keepers", async () => {
        // Register keeper
        await controller.connect(multisigPlaceholder).grantRole(KEEPER_ROLE, keeper.address);

        // Check keeper is registered
        expect(await controller.hasRole(KEEPER_ROLE, keeper.address)).to.be.true;
      });

      it("multisig can remove keepers", async () => {
        // Register keeper
        await controller.connect(multisigPlaceholder).grantRole(KEEPER_ROLE, keeper.address);

        // Deregister keeper
        await controller.connect(multisigPlaceholder).revokeRole(KEEPER_ROLE, keeper.address);

        // Check keeper is deregistered
        expect(await controller.hasRole(KEEPER_ROLE, keeper.address)).to.be.false;
      });
    });
  });

  describe("SwapHandlerRegistry", async () => {
    it("governor can register swap handler", async () => {
      // Register swap handler
      await controller
        .connect(multisigPlaceholder)
        .registerSwapAdapter(UNISWAP_SWAP_ADAPTER_HASH, swapAdapterPlaceholder.address);

      // Check swap handler is registered
      expect(await controller.swapAdapters(UNISWAP_SWAP_ADAPTER_HASH)).to.equal(swapAdapterPlaceholder.address);
    });
  });
});

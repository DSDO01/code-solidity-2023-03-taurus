import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { getContract } from "./testHelpers";

// Call this function to mint TAU to the recipient from governance.
export const mintHelper = async (amount: BigNumberish, recipient: string) => {
  // Get TAU
  const tau = await getContract("TAU");

  // Get Governance address
  const governanceAddress = await tau.governance();

  // Get Governance signer
  const governanceSigner = await ethers.getSigner(governanceAddress);

  // Get current governance mint limit (probably unnecessary, but useful to prevent possible unexpected issues)
  const currentMintLimit = await tau.mintLimit(governanceAddress);

  // Increase governance's allowance to mint TAU
  await tau.connect(governanceSigner).setMintLimit(governanceAddress, currentMintLimit.add(amount));

  // Mint TAU to recipient
  await tau.connect(governanceSigner).mint(recipient, amount);
};

export const mintAndApproveTauOrTgt = async (
  amount: BigNumberish,
  recipient: SignerWithAddress,
  approvalRecipient: string,
) => {
  await mintHelper(amount, recipient.address);
  await (await getContract("TAU")).connect(recipient).approve(approvalRecipient, amount);
};

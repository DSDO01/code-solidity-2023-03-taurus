import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { TAU } from "typechain";

import { ARBITRUM_WETH_ADDRESS } from "../../constants";
import { Erc20Artifacts } from "../ImportedArtifacts/Erc20Artifacts";

import { getNamedSigners } from "./testHelpers";

export const mintAndApproveToken = async (
  token: TAU, // tau is mintable
  recipient: SignerWithAddress,
  approvalRecipient: string,
  amount: BigNumberish,
  tokenOwner?: SignerWithAddress,
) => {
  if (tokenOwner === undefined) {
    tokenOwner = (await getNamedSigners()).deployer;
  }

  await token.mint(recipient.address, amount);
  await token.connect(recipient).approve(approvalRecipient, amount);
};

export const mintWethHelper = async (recipient: string, amount: BigNumberish) => {
  const deployer = (await getNamedSigners()).deployer;
  const weth = await ethers.getContractAt(Erc20Artifacts.arbitrumWethAbi, ARBITRUM_WETH_ADDRESS, deployer);

  const deployerEthBal = await deployer.getBalance();
  // Set deployer's balance to previous balance + amount
  await ethers.provider.send("hardhat_setBalance", [deployer.address, "0x" + deployerEthBal.add(amount).toString()]);

  await weth.deposit({ value: amount });
  await weth.transfer(recipient, amount);
};

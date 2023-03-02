import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { ethers } from "hardhat";
import { TAU, TauDripFeed } from "typechain";

import { POSITIONS_STATE, PRECISION } from "../../constants";

import { mintHelper } from "./tauHelpers";
import { getNamedSigners, getTimestampFromBlockNumber } from "./testHelpers";

export const modifyPositionHelperWithEvents = async (
  signer: SignerWithAddress,
  vault: Contract,
  collateralToDeposit: BigNumber,
  tauToBorrow: BigNumber,
  eventsToBeEmitted: POSITIONS_STATE[],
) => {
  const accDetails = await vault.userDetails(signer.address);
  if (eventsToBeEmitted.length === 2) {
    await expect(
      vault
        .connect(signer)
        .modifyPosition(collateralToDeposit.abs(), tauToBorrow.abs(), collateralToDeposit.gt(0), tauToBorrow.gt(0)),
    )
      .emit(vault, eventsToBeEmitted[0].toString())
      .withArgs(signer.address, tauToBorrow.abs().gt(accDetails.debt) ? accDetails.debt : tauToBorrow.abs())
      .emit(vault, eventsToBeEmitted[1].toString())
      .withArgs(signer.address, collateralToDeposit.abs());
  } else if (eventsToBeEmitted.length === 1) {
    await expect(
      vault
        .connect(signer)
        .modifyPosition(collateralToDeposit.abs(), tauToBorrow.abs(), collateralToDeposit.gt(0), tauToBorrow.gt(0)),
    )
      .emit(vault, eventsToBeEmitted[0].toString())
      .withArgs(signer.address, collateralToDeposit.abs().isZero() ? tauToBorrow.abs() : collateralToDeposit.abs());
  }
};

// Mainly this is meant to be called by other functions, once stuff like minting and approving has been handled.
export const modifyPositionHelper = async (
  signer: SignerWithAddress,
  vault: Contract,
  collateralToDeposit: BigNumber,
  tauToBorrow: BigNumber,
  checkEvents: boolean,
) => {
  if (checkEvents) {
    const posStates: POSITIONS_STATE[] = [];
    if (!tauToBorrow.abs().isZero()) {
      if (tauToBorrow.gt(0)) posStates.push(POSITIONS_STATE.Borrow);
      else posStates.push(POSITIONS_STATE.Repay);
    }

    if (!collateralToDeposit.abs().isZero()) {
      if (collateralToDeposit.gt(0)) posStates.push(POSITIONS_STATE.Deposit);
      else posStates.push(POSITIONS_STATE.Withdraw);
    }

    await modifyPositionHelperWithEvents(signer, vault, collateralToDeposit, tauToBorrow, posStates);
  } else {
    await vault
      .connect(signer)
      .modifyPosition(collateralToDeposit.abs(), tauToBorrow.abs(), collateralToDeposit.gt(0), tauToBorrow.gt(0));
  }
};

export const depositGlpHelper = async (
  depositor: SignerWithAddress,
  glpAmount: BigNumberish,
  vault: Contract,
  erc20Glp: Contract,
) => {
  await mintAndApproveGlpHelper(depositor, vault.address, glpAmount, erc20Glp);
  await modifyPositionHelper(depositor, vault, BigNumber.from(glpAmount), BigNumber.from(0), false);
};

export const distributeTauRewardsRewardsHelper = async (
  signer: SignerWithAddress,
  tauToDeposit: BigNumberish,
  vault: TauDripFeed,
  tau: TAU,
) => {
  // Mint deployer some TAU
  await mintHelper(tauToDeposit, signer.address);

  // Use it to distributeTauRewards in order to simulate TAU earnings
  await tau.connect(signer).approve(vault.address, tauToDeposit);
  const tx = await vault.connect(signer).distributeTauRewards(tauToDeposit);
  const txReceipt = await tx.wait();
  const txTimestamp = await getTimestampFromBlockNumber(txReceipt.blockNumber);
  return txTimestamp;
};

export const updateContractRewardsHelper = async (signer: SignerWithAddress, vault: Contract) => {
  // Call disburseTau
  const tx = await vault.connect(signer).disburseTau();
  const txDetails = await tx.wait();
  const txTimestamp = await getTimestampFromBlockNumber(txDetails.blockNumber);
  return txTimestamp;
};

export const updateUserRewardsHelper = async (user: SignerWithAddress, vault: Contract) => {
  const tx = await vault.connect(user).updateRewards(user.address);
  return tx.timestamp;
};

export const mintAndApproveGlpHelper = async (
  mintRecipient: SignerWithAddress,
  approveRecipient: string,
  glpAmount: BigNumberish,
  erc20Glp: Contract,
) => {
  // Mint GLP
  await mintStakedGlpHelper(mintRecipient, glpAmount, erc20Glp);

  // Approve GLP to approveRecipient
  await erc20Glp.connect(mintRecipient).approve(approveRecipient, glpAmount);
};

export const mintStakedGlpHelper = async (
  recipient: SignerWithAddress,
  glpAmount: BigNumberish,
  erc20Glp: Contract,
) => {
  const deployer = (await getNamedSigners()).deployer;
  // Due to GMX's mint behavior, we are just going to give the deployer a bunch of tokens at the beginning of any given test, then
  // transfer them to the "mint recipient" as a mint simulation. Simplifies things.

  const glpBalance = await erc20Glp.balanceOf(deployer.address);
  if (glpBalance.lt(glpAmount)) {
    throw new Error("Deployer lacks sufficient GLP to mint. Have you called mintGlpToDeployerHelper()?");
  }

  // "Mint" GLP
  await erc20Glp.transfer(recipient.address, glpAmount);
};

export const mintGlpToDeployerHelper = async (
  rewardRouterV2: Contract,
  ethAmount?: BigNumberish,
  minUsdg?: BigNumber,
  minGlp?: BigNumber,
) => {
  if (!ethAmount) ethAmount = PRECISION.mul(100); // By default, turn 100 ETH into GLP. This should be enough for most purposes.
  if (!minUsdg) minUsdg = BigNumber.from(0);
  if (!minGlp) minGlp = BigNumber.from(1); // This warns us if for whatever reason we are not getting any GLP back

  const deployer = (await getNamedSigners()).deployer;

  // Keep deployer's ETH high so that it can pay for this and transactions
  const formattedEthAmount = "0x" + PRECISION.mul(1000).add(ethAmount).toString();

  // Give deployer some ETH to pay for GLP
  await ethers.provider.send("hardhat_setBalance", [deployer.address, formattedEthAmount]);

  // Mint GLP
  await rewardRouterV2.mintAndStakeGlpETH(minUsdg, minGlp, { value: ethAmount });
};

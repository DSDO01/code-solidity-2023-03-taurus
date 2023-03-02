// Helpers for TauDripFeed.sol

import { BigNumber } from "ethers";
import { ethers } from "hardhat";

import { DRIP_DURATION } from "../../constants";

import { getTimestampFromBlockNumber } from "./testHelpers";

// Calculate expected tauWithheld in the TauDripFeed
export const calcExpectedTauWithheld = async (
  depositAmount: BigNumber,
  distributeTauRewardsTimestamp: number,
  currentTimestamp?: number,
  dripDuration?: number,
) => {
  if (dripDuration === undefined) {
    dripDuration = DRIP_DURATION;
  }

  if (currentTimestamp === undefined) {
    currentTimestamp = await getTimestampFromBlockNumber(await ethers.provider.getBlockNumber());
  }

  let timeElapsed = currentTimestamp - distributeTauRewardsTimestamp;
  if (timeElapsed > dripDuration) {
    timeElapsed = dripDuration;
  }

  const tokensDisbursed = depositAmount.mul(timeElapsed).div(dripDuration);

  // Get reward withheld
  return depositAmount.sub(tokensDisbursed);
};

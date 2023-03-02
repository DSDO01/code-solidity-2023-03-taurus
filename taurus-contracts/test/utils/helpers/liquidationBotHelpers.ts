import { BigNumber } from "ethers";

import { MIN_COLL_RATIO, PRECISION, UNDERWATER_COLL_RATIO } from "../../constants";

import { getNamedSigners, getNumAddresses } from "./testHelpers";

export const populateAccounts = async (numAccs: number, belowColRatio: number) => {
  const accAddrs = await getNumAddresses(numAccs);
  const collateral: BigNumber[] = [];
  const debt: BigNumber[] = [];
  let j = 0;

  for (let i = 0; i < numAccs; i++) {
    const collAmt = PRECISION.mul(i + 1);
    collateral.push(collAmt);
    if (j < belowColRatio) {
      debt.push(collAmt.mul(PRECISION).div(UNDERWATER_COLL_RATIO));
    } else {
      // Have a collRatio of atleast 121
      debt.push(collAmt.mul(PRECISION).div(MIN_COLL_RATIO.add(PRECISION.div(100))));
    }
    j++;
  }

  return {
    accAddress: accAddrs,
    collAmt: collateral,
    debtAmt: debt,
  };
};

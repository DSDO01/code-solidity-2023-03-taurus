// Helpers used to read and modify the test environment, such as by changing the block number.

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { deployments, ethers } from "hardhat";
import { ABI } from "hardhat-deploy/types";

import {
  LIQUIDATION_SURCHARGE,
  MAX_LIQ_COLL_RATIO,
  MAX_LIQ_DISCOUNT,
  MIN_COLL_RATIO,
  namedAccounts,
  PRECISION,
} from "../../constants";

// Each named account corresponds to its signerWithAddress, i.e. "deployer" -> SignerWithAddress
export type NamedSigners = {
  [key: string]: SignerWithAddress;
};

// Our version of hardhat's getNamedAccounts, which returns signers rather than addresses. This helps standardize addresses across tests and scripts.
export const getNamedSigners = async () => {
  const signers = await ethers.getSigners();

  const namedSigners: NamedSigners = {};
  for (let i = 0; i < namedAccounts.length; i++) {
    namedSigners[namedAccounts[i]] = signers[i];
  }

  return namedSigners;
};

export const getNumAddresses = async (num: number) => {
  const userAddresses: string[] = [];
  for (let i = 0; i < num; i++) {
    userAddresses.push(await generateRandomAddress());
  }

  return userAddresses;
};

export const generateRandomAddress = async () => {
  const randomBytes = await ethers.utils.randomBytes(20);
  const address = ethers.utils.getAddress(ethers.utils.hexlify(randomBytes));
  return address;
};

export const getContract = async (contractAbi: string | ABI, signer?: SignerWithAddress, address?: string) => {
  if (typeof contractAbi === "string") {
    const deployment = await deployments.get(contractAbi);
    if (!address) {
      address = deployment.address;
    }
    contractAbi = deployment.abi;
  }
  if (!address) {
    throw new Error("Address is required if contractAbi is not a string");
  }
  const contract = await ethers.getContractAt(contractAbi, address, signer);
  return contract;
};

export const getTimestampFromBlockNumber = async (blockNumber?: number) => {
  if (blockNumber === undefined) {
    blockNumber = await ethers.provider.getBlockNumber();
  }
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
};

export const increaseTimeAndMineBlock = async (durationInSec: number) => {
  await ethers.provider.send("evm_increaseTime", [durationInSec]);
  await ethers.provider.send("evm_mine", []);
};

export const areCloseEnough = (actual: BigNumber, expected: BigNumber, tolerance: BigNumber) => {
  const diff = actual.sub(expected).abs();
  return diff.lte(tolerance);
};

export const getImpersonatedContract = async (address: string) => {
  // Give the contract an ether
  await ethers.provider.send("hardhat_setBalance", [
    address,
    "0x1000000000000000000000000000000000000000000000000000000000000000",
  ]);

  // Impersonate contract
  return getImpersonatedSigner(address);
};

export const getImpersonatedSigner = async (address: string) => {
  await ethers.provider.send("hardhat_impersonateAccount", [address]);
  return ethers.getSigner(address);
};

export const getLiquidationValues = (
  collateral: BigNumber,
  debt: BigNumber,
  price: BigNumber,
  decimals: BigNumber,
  minCollateral?: BigNumber | number,
) => {
  if (!minCollateral) {
    minCollateral = 0;
  }
  const dec = BigNumber.from(10).pow(decimals);

  const userHealthFactor = getHealthFactor(collateral, debt, price, decimals);

  if (userHealthFactor.gte(MIN_COLL_RATIO)) {
    throw new Error("User is not liquidatable");
  }

  const totalDiscountAdditive = getLiquidationDiscount(userHealthFactor); // Size of discount on collateral as a fraction of PRECISION
  const totalDiscountMultiplicative = PRECISION.add(totalDiscountAdditive);

  const liqAmountExchRate = price.mul(totalDiscountMultiplicative).div(dec);

  let liqAmount = debt
    .mul(MAX_LIQ_COLL_RATIO)
    .sub(price.mul(PRECISION).mul(collateral).div(dec))
    .div(MAX_LIQ_COLL_RATIO.sub(totalDiscountMultiplicative));

  if (liqAmount.gt(debt)) {
    liqAmount = debt;
  }

  let collateralLiquidated = liqAmount.mul(totalDiscountMultiplicative).div(price).mul(dec).div(PRECISION);

  if (collateralLiquidated.gt(collateral)) {
    collateralLiquidated = collateral;
  }

  const collateralToFeeSplitter = liqAmount.mul(dec).mul(LIQUIDATION_SURCHARGE).div(price).div(PRECISION);
  const totalCollateralToLiquidator = collateralLiquidated.sub(collateralToFeeSplitter);

  if (totalCollateralToLiquidator.lt(minCollateral)) {
    throw new Error("Not enough collateral returned to liquidator");
  }

  return {
    liquidationAmount: liqAmount, // Max amount of debt that can be liquidated
    newCollateralAmount: collateral.sub(collateralLiquidated), // Amount of collateral left after liquidation, assuming max liquidation
    newDebtAmount: debt.sub(liqAmount), // Amount of debt left after liquidation, assuming max liquidation
    totalCollateralToLiquidator, // Amount of collateral that will go to the liquidator
    collToLiquidate: collateralLiquidated, // Amount of violator's collateral that will be liquidated
    collToFeeSplitter: collateralToFeeSplitter, // Amount of violator's collateral that will go to the fee splitter
  };
};

export const getLiquidationDiscount = (
  healthFactor: BigNumber,
  minHealthFactor?: BigNumber,
  liqSurcharge?: BigNumber,
) => {
  if (!minHealthFactor) {
    minHealthFactor = MIN_COLL_RATIO;
  }

  if (!liqSurcharge) {
    liqSurcharge = LIQUIDATION_SURCHARGE;
  }

  if (healthFactor.gte(minHealthFactor)) {
    throw new Error("User is not unhealthy");
  }

  let additiveDiscount = minHealthFactor.add(LIQUIDATION_SURCHARGE).sub(healthFactor);
  if (additiveDiscount.gt(MAX_LIQ_DISCOUNT)) {
    additiveDiscount = MAX_LIQ_DISCOUNT;
  }

  return additiveDiscount;
};

export const getHealthFactor = (collateral: BigNumber, debt: BigNumber, price: BigNumber, decimals: BigNumber) => {
  const dec = BigNumber.from(10).pow(decimals);
  return collateral.mul(price).mul(PRECISION).div(debt).div(dec);
};

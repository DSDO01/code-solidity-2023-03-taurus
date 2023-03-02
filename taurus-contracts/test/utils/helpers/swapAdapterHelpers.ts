import { BigNumber, BigNumberish, ethers } from "ethers";

import { GLP_VAULT_PROTOCOL_FEE_VALUE, HIGH_DEADLINE, PERCENT_PRECISION, PRECISION } from "../../constants";

export const calcReasonableSlippage = (
  inputAmount: BigNumber,
  exchangeRateX96: BigNumber, // token0 / token1
  allowableSlippagePercent?: number,
  protocolFee?: BigNumber,
) => {
  if (allowableSlippagePercent === undefined) {
    allowableSlippagePercent = 1;
  }
  if (protocolFee === undefined) {
    protocolFee = GLP_VAULT_PROTOCOL_FEE_VALUE;
  }

  const feesToProtocol = calculateFeeAmount(inputAmount, protocolFee);
  return inputAmount
    .sub(feesToProtocol)
    .mul(exchangeRateX96)
    .mul(100 - allowableSlippagePercent)
    .div(BigNumber.from(2).pow(96).mul(100));
};

// @param tokens = array of token addresses, starting from input token and ending with the token before the output token.
export const buildUniswapSwapAdapterData = (
  tokens: string[],
  fees: number[],
  inputAmount: BigNumberish,
  minOutputAmount: BigNumberish,
  protocolFee?: BigNumberish,
  deadline?: BigNumberish,
) => {
  if (protocolFee === undefined) {
    protocolFee = GLP_VAULT_PROTOCOL_FEE_VALUE;
  }
  if (deadline === undefined) {
    deadline = HIGH_DEADLINE;
  }

  const feesToProtocol = calculateFeeAmount(inputAmount, protocolFee);
  const finalInputAmount = BigNumber.from(inputAmount).sub(feesToProtocol);

  const path = formatSwapRouterPath(tokens, fees);
  const finalData = ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256", "uint256", "bytes"],
    [deadline, finalInputAmount, minOutputAmount, path],
  );

  return {
    swapData: finalData,
    feesToProtocol,
  };
};

// Pass in an array of tokens and an array of fees. This will return a bytes-encoded path.
export const formatSwapRouterPath = (tokens: string[], fees: number[]) => {
  // Check input lengths
  if (tokens.length !== fees.length + 1) {
    throw new Error("tokens array must be 1 longer than fees array");
  }

  return encodePackedPath(tokens, fees);
};

const encodePackedPath = (tokens: string[], fees: number[]) => {
  let finalString = "0x";

  // Format each token and fee
  for (let i = 0; i < tokens.length; i++) {
    // Each token is an address which are 20 bytes long. 2 characters is a byte, so each token address should be 42 characters with the 0x prefix.
    if (tokens[i].length !== 42) {
      throw new Error("token addresses must be 20 bytes long");
    }

    finalString += tokens[i].slice(2); // Slice off the first 2 characters to remove the '0x' prefix

    // for all but the last token, next add the fee between the two preceding tokens
    if (i < fees.length) {
      // Each fee is a uint24, which is 3 bytes long. 2 characters is a byte, so each fee should be 6 characters in total.
      const baseSixteenFee = fees[i].toString(16);
      const paddedFee = baseSixteenFee.padStart(6, "0");
      finalString += paddedFee;
    }
  }

  return finalString;
};

// Return max expected slippage, expected return (without any slippage), and amount of yield token sent to FeeSplitter
export const swapCalculator = (
  exchangeRate: BigNumberish, // TAU * PRECISION / collateral
  inputAmount: BigNumberish, // Amount of collateral being swapped
  protocolFee: BigNumberish, // Proportion of vault yield heading to the FeeSplitter, as a fraction of PRECISION
  maxSlippage: BigNumberish, // Minimum acceptable proportion of TAU returned, as a fraction of PRECISION
) => {
  const amountToSwap = BigNumber.from(inputAmount).sub(calculateFeeAmount(inputAmount, protocolFee));
  const expectedReturn = BigNumber.from(amountToSwap).mul(exchangeRate).div(PRECISION);
  const minReturn = expectedReturn.mul(maxSlippage).div(PRECISION);
  return {
    minTokensReturned: minReturn,
    maxTokensReturned: expectedReturn,
    tokensToFeeSplitter: BigNumber.from(inputAmount).sub(amountToSwap),
  };
};

export const calculateFeeAmount = (
  inputAmount: BigNumberish,
  protocolFee: BigNumberish, // Proportion of vault yield heading to the FeeSplitter, as a fraction of PERCENT_PRECISION i.e. 1e18
) => {
  return BigNumber.from(inputAmount).mul(protocolFee).div(PERCENT_PRECISION);
};

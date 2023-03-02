import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { ethers } from "hardhat";
import { ERC20, TAU } from "typechain";

import { UniswapArtifacts } from "../ImportedArtifacts/UniswapArtifacts";
import {
  ARBITRUM_UNISWAP_V3_FACTORY_ADDRESS,
  ARBITRUM_UNISWAP_V3_NFT_MANAGER_ADDRESS,
  HIGH_DEADLINE,
  PRECISION,
} from "../../constants";

import { mintAndApproveToken, mintWethHelper } from "./erc20Helpers";
import { mintAndApproveTauOrTgt } from "./tauHelpers";
import { getNamedSigners } from "./testHelpers";

export enum MintMethod {
  mock = "mock",
  tauOrTgt = "tauOrTgt",
  weth = "weth",
}

// Note that if one token is TAU, it should be tokenA.
export const setupPoolHelper = async (
  tokens: [ERC20, ERC20],
  tokenMintMethods: [MintMethod, MintMethod],
  initPositionHolder: SignerWithAddress,
  initPositionSize?: BigNumberish,
  initExchangeRate?: BigNumberish,
) => {
  if (initPositionSize === undefined) {
    initPositionSize = PRECISION.mul(1_000_000);
  }

  const { deployer } = await getNamedSigners();

  const nftManager = await ethers.getContractAt(
    UniswapArtifacts.NonfungiblePositionManager.abi,
    ARBITRUM_UNISWAP_V3_NFT_MANAGER_ADDRESS,
    deployer,
  );

  const uniFactory = await ethers.getContractAt(
    UniswapArtifacts.UniswapV3Factory.abi,
    ARBITRUM_UNISWAP_V3_FACTORY_ADDRESS,
    deployer,
  );

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const mintMethod = tokenMintMethods[i];
    if (mintMethod === MintMethod.mock) {
      await mintAndApproveToken(token as TAU, initPositionHolder, nftManager.address, initPositionSize);
    } else if (mintMethod === MintMethod.tauOrTgt) {
      await mintAndApproveTauOrTgt(initPositionSize, initPositionHolder, nftManager.address);
    } else {
      await mintWethHelper(initPositionHolder.address, initPositionSize);
    }
  }

  await setupPool(tokens[0], tokens[1], initPositionHolder, nftManager, uniFactory, initPositionSize, initExchangeRate);
};

// This function assumes that initPositionHolder already has enough tokens and that the pool is not yet created.
export const setupPool = async (
  tokenA: ERC20,
  tokenB: ERC20,
  initPositionHolder: SignerWithAddress,
  nftManager: Contract,
  uniFactory: Contract,
  initPositionSize?: BigNumberish,
  initExchangeRate?: BigNumberish,
) => {
  if (initPositionSize === undefined) {
    initPositionSize = PRECISION.mul(1000);
  }

  if (initExchangeRate === undefined) {
    initExchangeRate = BigNumber.from(2).pow(96);
  }

  // Create pool
  await uniFactory.createPool(tokenA.address, tokenB.address, 3000);

  // Approve tokens to NftManager
  await tokenA.connect(initPositionHolder).approve(nftManager.address, initPositionSize);
  await tokenB.connect(initPositionHolder).approve(nftManager.address, initPositionSize);

  let firstAddress: string;
  let secondAddress: string;

  // Swap the tokens to make sure they're in alphabetical order
  if (tokenA.address.toLocaleLowerCase() > tokenB.address.toLocaleLowerCase()) {
    firstAddress = tokenB.address;
    secondAddress = tokenA.address;
    initExchangeRate = BigNumber.from(2).pow(192).div(initExchangeRate); // Exchange rate is reversed
  } else {
    firstAddress = tokenA.address;
    secondAddress = tokenB.address;
  }

  // Initialize pool
  const poolAddress = await uniFactory.getPool(tokenA.address, tokenB.address, 3000);
  const pool = await ethers.getContractAt(UniswapArtifacts.Pool.abi, poolAddress, initPositionHolder);
  await pool.initialize(initExchangeRate);
  await pool.increaseObservationCardinalityNext(1000); // Add some space for the oracle to record observations

  // Create enormous position in pool
  const mintParams = {
    token0: firstAddress,
    token1: secondAddress,
    fee: 3000,
    tickLower: -887220,
    tickUpper: 887220,
    amount0Desired: initPositionSize,
    amount1Desired: initPositionSize,
    amount0Min: 0,
    amount1Min: 0,
    recipient: initPositionHolder.address,
    deadline: HIGH_DEADLINE,
  };

  await nftManager.connect(initPositionHolder).mint(mintParams);
};

import {
  type Address,
  encodeAbiParameters,
  parseAbiParameters,
  type Hash,
} from "viem";

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface SwapToShieldParams {
  key: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  minAmountOut: bigint;
  sqrtPriceLimitX96: bigint;
  commitment: `0x${string}`;
  shieldedPool: Address;
  hookData: `0x${string}`;
}

export interface ShieldedSwapParams {
  poolSource: Address;
  proof: `0x${string}`;
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  relayerFee: bigint;
  key: PoolKey;
  zeroForOne: boolean;
  minAmountOut: bigint;
  sqrtPriceLimitX96: bigint;
  newCommitment: `0x${string}`;
  poolDestination: Address;
  hookData: `0x${string}`;
}

export const MIN_SQRT_RATIO = 4_295_128_739n;
export const MAX_SQRT_RATIO = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342n;

export function encodeHookAttestationData(userAddress: Address): `0x${string}` {
  return encodeAbiParameters(parseAbiParameters("address user"), [userAddress]);
}

export function formatPoolKey(tokenA: Address, tokenB: Address, hookAddress: Address, fee = 3000, tickSpacing = 60): PoolKey {
  const isA0 = BigInt(tokenA) < BigInt(tokenB);
  return {
    currency0: isA0 ? tokenA : tokenB,
    currency1: isA0 ? tokenB : tokenA,
    fee,
    tickSpacing,
    hooks: hookAddress,
  };
}

export function calculateSlippageBound(expectedOut: bigint, slippagePercent: number): bigint {
  const bps = BigInt(Math.floor(slippagePercent * 100));
  return (expectedOut * (10_000n - bps)) / 10_000n;
}

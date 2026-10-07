import { decodeEventLog, type Address, type Hash, type PublicClient } from "viem";
import { VEIL_SHIELD_ROUTER_ABI } from "./veil-artifact";
import { calculateSlippageBound, type SwapToShieldParams } from "./router-client";

// ---------------------------------------------------------------------------
// Task 2 (testnet end-to-end UI): VeilShieldRouter.swapToShield via the trade
// page on Robinhood Testnet (chain 46630).
//
// QUOTE-SOURCE DECISION (R2): the quote is a REAL exact-output simulation —
// an eth_call (simulateContract) of the router's own `swapToShield` with
// minAmountOut = 0 against the latest block. Rationale, verified 2026-10-07:
// - No dedicated v4 Quoter deployment on 46630 is referenced anywhere in this
//   repo or its scripts, so no quoter address was trusted.
// - StateView IS deployed at its canonical address on 46630
//   (0xf3334192d15450cdd385c8b70e03f9a6bd9e673b — scripts/v4pool-testnet.mjs
//   reads getSlot0/getLiquidity from it), but it only exposes slot/liquidity,
//   not quotes; reimplementing swap math offchain would be an estimate, not
//   a quote.
// - `swapToShield` returns uint256 amountOut, and scripts/router-swap-testnet.mjs
//   already proves a pre-tx eth_call simulation of the exact calldata succeeds.
//   Simulating the real calldata exercises the live pool state AND the
//   denomination guard, so the returned amountOut is the exact live output —
//   never a hardcoded or dummy number. Execution re-simulates in the same
//   block window before sending, so minAmountOut is always derived from fresh
//   state plus the user's slippage setting.
// - Caveat surfaced honestly in the UI: simulation runs `from` the connected
//   wallet, so without a prior VEIL approval it reverts on allowance and the
//   UI asks for approval first instead of showing a number.
// ---------------------------------------------------------------------------

export const TESTNET_CHAIN_ID = 46630;

export const TESTNET_ROUTER_ADDRESS =
  "0xb1baee8d519a7a2edbaff99eec0ba10948670d68" as Address;
export const TESTNET_LEGACY_ETH_POOL =
  "0x1b1d39e4da649747ecc0e93e7a06452a3061de17" as Address;
export const TESTNET_VEIL_TOKEN =
  "0x019086f63407fadf0ccb89516e465baef5031aa9" as Address;
export const ETH_ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

// Live pool truth, verified onchain via eth_call on 2026-10-07:
// denomination() = 1000000000000000 (0.001 ETH), asset() = address(0),
// depositsPaused() = false, poolCap() = 1e19, totalDeposits() = 2e15.
// The UI still re-reads these live before every execution (fail closed).
export const TESTNET_SHIELD_DENOMINATION = 1000000000000000n;

// Proven-route constants, verbatim from scripts/router-swap-testnet.mjs
// (liquid ETH/VEIL v4 pool: VEIL in -> ETH out -> legacy ETH pool deposit).
// poolKey: { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60,
// hooks: 0x0 (unhooked pool, so hookData is empty) }.
export const TESTNET_ROUTER_POOL_KEY = {
  currency0: ETH_ZERO_ADDRESS,
  currency1: TESTNET_VEIL_TOKEN,
  fee: 3000,
  tickSpacing: 60,
  hooks: ETH_ZERO_ADDRESS,
} as const;

export const TESTNET_ROUTER_SQRT_PRICE_LIMIT =
  14614467034852101032872730522039888242097890n;
export const TESTNET_ROUTER_HOOK_DATA = "0x" as const;

export const TESTNET_EXPLORER_TX_BASE =
  "https://explorer.testnet.chain.robinhood.com/tx/";

export const UINT128_MAX = (1n << 128n) - 1n;

/** Default VEIL input shown in the UI — mirrors the proven script amount. */
export const PROVEN_SCRIPT_VEIL_AMOUNT_IN = "2";

export const VEIL_ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const POOL_GUARD_ABI = [
  {
    type: "function",
    name: "denomination",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "poolCap",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalDeposits",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "depositsPaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

export interface SwapGuards {
  denomination: bigint;
  paused: boolean;
  cap: bigint;
  total: bigint;
}

/**
 * Parse + validate the shared slippage % string. Throws an honest Error for
 * anything that is not a finite percent in [0, 100).
 */
export function parseSlippagePercent(raw: string): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0 || value >= 100) {
    throw new Error(
      "Slippage setting must be a number from 0 up to (but not including) 100. Open Execution Settings and enter a valid percent."
    );
  }
  return value;
}

export function slippageBps(percent: number): bigint {
  return BigInt(Math.floor(percent * 100));
}

export interface BuildSwapToShieldArgs {
  amountIn: bigint;
  quotedOut: bigint;
  slippagePercent: number;
  commitment: `0x${string}`;
}

/**
 * Pure builder for the router `swapToShield` params on the proven testnet
 * route. minAmountOut is ALWAYS derived from the live simulated output and
 * the user's slippage setting — never hardcoded.
 */
export function buildSwapToShieldParams(
  args: BuildSwapToShieldArgs
): SwapToShieldParams {
  if (args.amountIn <= 0n) throw new Error("VEIL input amount must be greater than zero.");
  if (args.amountIn > UINT128_MAX)
    throw new Error("VEIL input amount exceeds the router uint128 limit.");
  if (args.quotedOut <= 0n)
    throw new Error("Live simulated output must be greater than zero before building swap params.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(args.commitment))
    throw new Error("Commitment must be a 32-byte hash.");
  const minAmountOut = calculateSlippageBound(args.quotedOut, args.slippagePercent);
  return {
    key: {
      currency0: TESTNET_ROUTER_POOL_KEY.currency0,
      currency1: TESTNET_ROUTER_POOL_KEY.currency1,
      fee: TESTNET_ROUTER_POOL_KEY.fee,
      tickSpacing: TESTNET_ROUTER_POOL_KEY.tickSpacing,
      hooks: TESTNET_ROUTER_POOL_KEY.hooks,
    },
    zeroForOne: false,
    amountIn: args.amountIn,
    minAmountOut,
    sqrtPriceLimitX96: TESTNET_ROUTER_SQRT_PRICE_LIMIT,
    commitment: args.commitment,
    shieldedPool: TESTNET_LEGACY_ETH_POOL,
    hookData: TESTNET_ROUTER_HOOK_DATA,
  };
}

function findErrorName(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== "object" || depth > 4) return null;
  const record = error as Record<string, unknown>;
  if (typeof record.errorName === "string") return record.errorName;
  const nested = record.cause ?? record.error;
  if (nested && typeof nested === "object") return findErrorName(nested, depth + 1);
  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const nested =
      error.cause instanceof Error ? ` ${error.cause.message}` : "";
    return `${error.message}${nested}`;
  }
  return String(error);
}

export function isUserRejection(error: unknown): boolean {
  return /user rejected|user denied|rejected the request|action_rejected/i.test(
    messageOf(error)
  );
}

/**
 * Map any quote/execution failure to an honest English message that surfaces
 * the contract reason (§7 #2). Never fabricates numbers.
 */
export function mapRouterSwapError(error: unknown, slippagePercent?: number): string {
  if (isUserRejection(error))
    return "Transaction cancelled in your wallet. No transaction was sent.";
  const name = findErrorName(error);
  const msg = messageOf(error);
  const slip =
    slippagePercent !== undefined && Number.isFinite(slippagePercent)
      ? ` Your slippage setting is ${slippagePercent}%.`
      : "";
  if (
    name === "SlippageExceeded" ||
    /SlippageExceeded/i.test(msg)
  )
    return (
      "Swap reverted: the live output moved below your slippage bound (SlippageExceeded)." +
      slip +
      " Try again, raise slippage in Execution Settings, or increase the VEIL input."
    );
  if (
    name === "InsufficientOutputForDenomination" ||
    /InsufficientOutputForDenomination/i.test(msg)
  )
    return "Swap output is below the 0.001 ETH shielded-note denomination (InsufficientOutputForDenomination). Increase the VEIL input and try again. No transaction was sent.";
  if (
    name === "NonZeroBalanceInvariantFailed" ||
    /NonZeroBalanceInvariantFailed/i.test(msg)
  )
    return "Router safety invariant failed: the router would retain dust after settlement (NonZeroBalanceInvariantFailed). Aborted with no funds moved. Try again later.";
  if (/insufficient allowance|ERC20InsufficientAllowance|exceeds allowance/i.test(msg))
    return "The router is not approved to spend this VEIL yet. Approve VEIL for the router first, then the live quote refreshes and you can execute.";
  if (/insufficient balance|ERC20InsufficientBalance/i.test(msg))
    return `Insufficient test VEIL balance. The router route needs test VEIL (${TESTNET_VEIL_TOKEN}) already in your wallet — the proven script ran on a pre-funded operator balance and there is no onchain faucet. Fund test VEIL and try again.`;
  if (/paused|cap/i.test(msg) && /pool/i.test(msg)) return msg;
  if (error instanceof Error && error.message) return error.message;
  return "Router swap failed before execution. Check your wallet, testnet connection, and VEIL balance, then try again.";
}

export async function readSwapGuards(
  client: PublicClient,
  pool: Address = TESTNET_LEGACY_ETH_POOL
): Promise<SwapGuards> {
  const [denomination, paused, cap, total] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_GUARD_ABI, functionName: "denomination" }),
    client.readContract({ address: pool, abi: POOL_GUARD_ABI, functionName: "depositsPaused" }),
    client.readContract({ address: pool, abi: POOL_GUARD_ABI, functionName: "poolCap" }),
    client.readContract({ address: pool, abi: POOL_GUARD_ABI, functionName: "totalDeposits" }),
  ]);
  return { denomination, paused, cap, total };
}

export async function readVeilBalance(
  client: PublicClient,
  owner: Address
): Promise<bigint> {
  return client.readContract({
    address: TESTNET_VEIL_TOKEN,
    abi: VEIL_ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

export async function readVeilAllowance(
  client: PublicClient,
  owner: Address,
  spender: Address = TESTNET_ROUTER_ADDRESS
): Promise<bigint> {
  return client.readContract({
    address: TESTNET_VEIL_TOKEN,
    abi: VEIL_ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });
}

export interface QuoteSwapArgs {
  account: Address;
  amountIn: bigint;
  commitment: `0x${string}`;
}

/**
 * REAL quote: eth_call simulation of the exact `swapToShield` calldata with
 * minAmountOut = 0. Returns the exact live ETH output for the given VEIL
 * input. Reverts (like the real tx would) when the route cannot serve it.
 */
export async function quoteSwapToShieldOutput(
  client: PublicClient,
  args: QuoteSwapArgs
): Promise<bigint> {
  const params = buildSwapToShieldParams({
    amountIn: args.amountIn,
    quotedOut: 1n,
    slippagePercent: 0,
    commitment: args.commitment,
  });
  const zeroMin = { ...params, minAmountOut: 0n };
  const { result } = await client.simulateContract({
    address: TESTNET_ROUTER_ADDRESS,
    abi: VEIL_SHIELD_ROUTER_ABI,
    functionName: "swapToShield",
    args: [zeroMin],
    account: args.account,
  });
  return result as bigint;
}

export interface SwapToShieldExecuted {
  swapper: Address;
  shieldedPool: Address;
  commitment: `0x${string}`;
  amountIn: bigint;
  amountOut: bigint;
  txHash: Hash;
}

/**
 * Assert the SwapToShieldExecuted event for our commitment exists in the
 * mined receipt logs. Returns null when absent (caller fails closed).
 */
export function findSwapToShieldExecuted(
  logs: readonly {
    data: `0x${string}`;
    topics: readonly `0x${string}`[];
  }[],
  commitment: `0x${string}`
): Omit<SwapToShieldExecuted, "txHash"> | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: VEIL_SHIELD_ROUTER_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName !== "SwapToShieldExecuted") continue;
      const evt = decoded.args as unknown as SwapToShieldExecuted;
      if (evt.commitment.toLowerCase() === commitment.toLowerCase()) {
        return {
          swapper: evt.swapper,
          shieldedPool: evt.shieldedPool,
          commitment: evt.commitment,
          amountIn: evt.amountIn,
          amountOut: evt.amountOut,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function explorerTxUrl(hash: string): string {
  return `${TESTNET_EXPLORER_TX_BASE}${hash}`;
}

// ---------------------------------------------------------------------------
// Task 4 (testnet end-to-end UI): ShieldedSwap tab adapter for
// VeilShieldRouter.shieldedSwap on Robinhood Testnet (chain 46630).
//
// OWNERSHIP: this file belongs to the Task 4 UI implementer. The proof-bound
// param builders in lib/shielded-swap.ts belong to the parallel agent — they
// are REUSED here (imported, never edited).
//
// ROUTER-VERSION RECONCILIATION (verified 2026-10-07, see task-4-report.md):
// - Current VeilShieldRouter.shieldedSwap (contracts/VeilShieldRouter.sol +
//   VEIL_SHIELD_ROUTER_ABI, deployed at 0xb1baee8d519a7a2edbaff99eec0ba10948670d68
//   with code onchain) takes ShieldedSwapParams { poolSource, proof, root,
//   nullifierHash, relayerFee, key, zeroForOne, minAmountOut, sqrtPriceLimitX96,
//   newCommitment, poolDestination, hookData }.
// - scripts/shielded-swap-v2.mjs targets an OLDER SwapHelper contract
//   (0x14c27b66fba1b561a920bd03970ae20c53608dff) whose swapExactIn takes an
//   `inputToken` param the current router does not have, plus the v3 0xbow
//   suite (entrypoint 0xdc473a2fb03585e8870baaf2d4742b2643de300d). It performs
//   a MANUAL 4-leg flow and never calls VeilShieldRouter.shieldedSwap, so it
//   proves only that the v4 ETH/VEIL poolKey route is liquid — not the router
//   path. The poolKey itself is reused verbatim below.
// - Only LEGACY Veil ShieldedPool contracts match the router's IShieldedPool
//   interface (withdraw(bytes,bytes32,bytes32,address,uint256)). The 0xbow
//   pools (audited 0x2bea7094f77e3f9a21397c688de8ef105d4848bc and the v3 suite
//   pools) expose withdraw(tuple,tuple) via Entrypoint.relay instead, so they
//   can be NEITHER poolSource NOR poolDestination for shieldedSwap.
// - Testnet now deploys THREE legacy pools: ShieldedPool_ETH
//   (deployments/testnet-latest.json) plus ShieldedPool_VEIL (0.5 VEIL) and
//   ShieldedPool_VEIL2 (2 VEIL) in deployments/shieldedpool-veil*-latest.json.
// - DIRECTION CONSTRAINT (proven onchain 2026-10-07, see task-4b-report.md):
//   the ETH -> VEIL direction is UNEXECUTABLE against the deployed router —
//   the zero-floor simulation of the exact shieldedSwap calldata reverts with
//   "eth settle failed" (_settleCurrency pushes native ETH to the PoolManager
//   with a bare call, but canonical v4 PoolManager has no receive/fallback;
//   only settle{value} works, which the router never uses). The VEIL -> ETH
//   direction settles ERC20 via safeTransfer (the proven swapToShield pattern)
//   and executes fine — proven live in the same report. The tab therefore
//   plans VEIL2 -> ETH (zeroForOne=false); an ETH source is never offered.
// ---------------------------------------------------------------------------

import type { Address, Hash, PublicClient } from "viem";
import {
  buildShieldedSwapParams,
  type ShieldedSwapExecutionParams,
} from "./shielded-swap";
import type { PoolKey } from "./router-client";
import {
  TESTNET_CHAIN_ID,
  TESTNET_EXPLORER_TX_BASE,
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_ROUTER_ADDRESS,
  TESTNET_ROUTER_POOL_KEY,
  TESTNET_VEIL_TOKEN,
} from "./router-swap";
import type { ShieldedNote } from "./note";

export const SHIELDED_SWAP_CHAIN_ID = TESTNET_CHAIN_ID;
export const SHIELDED_SWAP_ROUTER = TESTNET_ROUTER_ADDRESS;
// Executable direction is VEIL -> ETH (see header): source is the 2 VEIL pool
// (live quote 2 VEIL -> ~0.00157 ETH funds the 0.001 ETH dest note),
// destination is the legacy ETH pool.
export const SHIELDED_SWAP_SOURCE_POOL =
  "0x172e9cc542cf9349813f74548eec6e0a1df65e17" as Address;
export const SHIELDED_SWAP_SOURCE_DENOMINATION = 2000000000000000000n;
export const SHIELDED_SWAP_SOURCE_ASSET = TESTNET_VEIL_TOKEN;
export const SHIELDED_SWAP_DESTINATION_POOL = TESTNET_LEGACY_ETH_POOL;
export const SHIELDED_SWAP_EXPLORER_TX_BASE = TESTNET_EXPLORER_TX_BASE;

// Proven-liquid v4 route, verbatim from scripts/router-swap-testnet.mjs
// (VEIL <-> ETH, fee 3000, tickSpacing 60, no hooks). Only the VEIL -> ETH
// leg is router-executable (zeroForOne=false); the reverse leg cannot settle
// native input through the deployed router (see header).
export const SHIELDED_SWAP_POOL_KEY: PoolKey = {
  currency0: TESTNET_ROUTER_POOL_KEY.currency0,
  currency1: TESTNET_ROUTER_POOL_KEY.currency1,
  fee: TESTNET_ROUTER_POOL_KEY.fee,
  tickSpacing: TESTNET_ROUTER_POOL_KEY.tickSpacing,
  hooks: TESTNET_ROUTER_POOL_KEY.hooks,
} as const;

// Source note is shielded VEIL, so the swap leg sells VEIL (currency1) for ETH.
export const SHIELDED_SWAP_ZERO_FOR_ONE = false as const;

// Legacy Veil ShieldedPool inventory on testnet 46630: ShieldedPool_ETH from
// deployments/testnet-latest.json plus ShieldedPool_VEIL (0.5 VEIL) and
// ShieldedPool_VEIL2 (2 VEIL, the executable source) from
// deployments/shieldedpool-veil*-testnet-latest.json.
export const KNOWN_TESTNET_LEGACY_POOLS: readonly Address[] = [
  TESTNET_LEGACY_ETH_POOL,
  "0xd73920a3cbfdf3f6be530cab73fc9c876619517a" as Address,
  SHIELDED_SWAP_SOURCE_POOL,
] as const;

export const SHIELDED_SWAP_MISSING_POOL_LABEL =
  "ShieldedPool_VEIL (second-asset legacy pool)" as const;

/**
 * Resolves the destination pool for the executable VEIL -> ETH direction:
 * the legacy ETH pool. Returns null only while the inventory holds no
 * distinct pool (R3 gating). A same-pool "swap" is never returned: swapping
 * an asset into itself has no v4 route and cannot fund a new-denomination
 * note.
 */
export function resolveShieldedSwapDestination(
  exclude: Address = SHIELDED_SWAP_SOURCE_POOL
): Address | null {
  const found = KNOWN_TESTNET_LEGACY_POOLS.find(
    (pool) => pool.toLowerCase() !== exclude.toLowerCase()
  );
  return found ?? null;
}

export interface ShieldedSwapRouteStatus {
  executable: boolean;
  chainId: number;
  router: Address;
  sourcePool: Address;
  sourceDenomination: bigint;
  poolKey: PoolKey;
  zeroForOne: boolean;
  destination: Address | null;
  missingPool: string | null;
  unblock: string | null;
}

/**
 * Single source of truth for the ShieldedSwap tab state (config-level plan).
 * executable derives from the pool inventory — never a hardcoded flag — and
 * the execution handler additionally enforces the LIVE gate
 * (readShieldedSwapRouteStatusLive) before any transaction is built.
 */
export function getShieldedSwapRouteStatus(): ShieldedSwapRouteStatus {
  const destination = resolveShieldedSwapDestination();
  if (destination === null) {
    return {
      executable: false,
      chainId: SHIELDED_SWAP_CHAIN_ID,
      router: SHIELDED_SWAP_ROUTER,
      sourcePool: SHIELDED_SWAP_SOURCE_POOL,
      sourceDenomination: SHIELDED_SWAP_SOURCE_DENOMINATION,
      poolKey: SHIELDED_SWAP_POOL_KEY,
      zeroForOne: SHIELDED_SWAP_ZERO_FOR_ONE,
      destination: null,
      missingPool: SHIELDED_SWAP_MISSING_POOL_LABEL,
      unblock:
        "Deploy a VEIL-denominated legacy ShieldedPool exposing the router's " +
        "IShieldedPool interface (withdraw(bytes,bytes32,bytes32,address,uint256), " +
        "denomination(), asset(), deposit(bytes32)) on chain 46630, then list it in " +
        "KNOWN_TESTNET_LEGACY_POOLS. The ShieldedSwap tab enables automatically — " +
        "no UI rewrite needed.",
    };
  }
  return {
    executable: true,
    chainId: SHIELDED_SWAP_CHAIN_ID,
    router: SHIELDED_SWAP_ROUTER,
    sourcePool: SHIELDED_SWAP_SOURCE_POOL,
    sourceDenomination: SHIELDED_SWAP_SOURCE_DENOMINATION,
    poolKey: SHIELDED_SWAP_POOL_KEY,
    zeroForOne: SHIELDED_SWAP_ZERO_FOR_ONE,
    destination,
    missingPool: null,
    unblock: null,
  };
}

export type ShieldedSwapRelayPath = "self-relay" | "hosted-relay";

export interface ShieldedSwapRelaySelection {
  path: ShieldedSwapRelayPath;
  relayerFee: bigint;
  note: string;
}

/**
 * Fallback-path selection (R2 / §7 #6). Self-relay is the DEFAULT and the
 * only live path: the user pays gas and relayerFee binds to 0. The hosted
 * path is an explicit hookup point only — no relayer service exists on
 * testnet, so requesting it still resolves to self-relay with an honest note
 * instead of claiming a service that is not there. Relayer-down (§7 #6) is
 * satisfied BY the self-relay path.
 */
export function selectShieldedSwapRelayPath(options?: {
  hostedRequested?: boolean;
}): ShieldedSwapRelaySelection {
  if (options?.hostedRequested) {
    return {
      path: "self-relay",
      relayerFee: 0n,
      note: "No hosted relayer service exists on testnet 46630, so the swap falls back to self-relay: you pay gas and relayerFee stays 0. This fallback is exactly how the protocol survives a relayer outage (§7 #6).",
    };
  }
  return {
    path: "self-relay",
    relayerFee: 0n,
    note: "Self-relay (default): your wallet submits the transaction, pays gas, and relayerFee is bound to 0 inside the proof context.",
  };
}

export interface BuildSelfRelayShieldedSwapArgs {
  note: ShieldedNote;
  proof: `0x${string}`;
  root: `0x${string}`;
  quotedAmountOut: bigint;
  slippagePercent: number;
  newCommitment: `0x${string}`;
  poolDestination: Address | null;
  relayerFee?: bigint;
  hookData?: `0x${string}`;
  poolSource?: Address;
  poolKey?: PoolKey;
  zeroForOne?: boolean;
  sqrtPriceLimitX96?: bigint;
}

/**
 * Thin self-relay wrapper over the parallel agent's buildShieldedSwapParams
 * (reused, never reimplemented). Binds relayerFee to 0 and fails closed when
 * the destination pool is still pending, so no params can be built for a
 * swap that cannot settle. minAmountOut always derives from the live quote ×
 * user slippage — never hardcoded. Direction (poolSource/poolKey/zeroForOne)
 * passes through, defaulting to the executable VEIL -> ETH plan.
 */
export function buildSelfRelayShieldedSwapArgs(
  args: BuildSelfRelayShieldedSwapArgs
): ShieldedSwapExecutionParams {
  if (args.poolDestination === null) {
    throw new Error(
      "Shielded swap destination pool is pending: no second shielded pool is deployed on testnet 46630 yet. No params were built and no transaction was sent."
    );
  }
  if (args.relayerFee !== undefined && args.relayerFee !== 0n) {
    throw new Error(
      "Self-relay binds relayerFee to 0. A nonzero fee needs the hosted-relay path, which has no live service on testnet."
    );
  }
  return buildShieldedSwapParams({
    note: args.note,
    proof: args.proof,
    root: args.root,
    poolSource: args.poolSource ?? SHIELDED_SWAP_SOURCE_POOL,
    poolDestination: args.poolDestination,
    poolKey: args.poolKey ?? SHIELDED_SWAP_POOL_KEY,
    zeroForOne: args.zeroForOne ?? SHIELDED_SWAP_ZERO_FOR_ONE,
    quotedAmountOut: args.quotedAmountOut,
    slippagePercent: args.slippagePercent,
    relayerFee: 0n,
    newCommitment: args.newCommitment,
    hookData: args.hookData,
    sqrtPriceLimitX96: args.sqrtPriceLimitX96,
  });
}

/**
 * Single source of truth for whether the ShieldedSwap Execute button stays
 * disabled. Disabled until a live destination pool exists AND a spendable
 * note is selected AND no proof/simulation is in flight.
 */
export function isShieldedSwapExecuteDisabled(args: {
  isExecuting: boolean;
  connected: boolean;
  hasNotes: boolean;
  destinationAvailable: boolean;
  isProving: boolean;
}): boolean {
  if (args.isExecuting) return true;
  if (!args.connected) return false;
  if (!args.hasNotes) return true;
  if (!args.destinationAvailable) return true;
  if (args.isProving) return true;
  return false;
}

/** Fail-closed English copy for the pending-destination state (R5). */
export function shieldedSwapPendingMessage(status: ShieldedSwapRouteStatus): string {
  return (
    `Shielded Swap is not executable yet: the destination pool (${status.missingPool}) ` +
    `is not deployed on testnet 46630. Planned route — shielded ETH (${status.sourcePool}) -> ` +
    `v4 ETH/VEIL swap via VeilShieldRouter.shieldedSwap (${status.router}) -> destination pool pending. ` +
    `Your funds stay safe in the pool; use Withdraw for now. ` +
    (status.unblock ?? "")
  );
}

// ---------------------------------------------------------------------------
// LIVE-READ gate (Task 4b R2 — fixes T4 I-1). The config status above is the
// render-time plan; THIS is the enforcement layer the execution path calls
// before building any params: every known pool is read onchain
// (denomination()/asset()/depositsPaused()), and executable requires >= 2
// unpaused pools plus a liquid v4 route. No hardcoded executable flag: a pool
// that pauses, a vanished route, or a drained quoter all flip executable to
// false with an honest reason.
// ---------------------------------------------------------------------------

const SHIELDED_POOL_LIVE_ABI = [
  {
    type: "function",
    name: "denomination",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "depositsPaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

const V4_STATE_VIEW_ABI = [
  {
    type: "function",
    name: "getLiquidity",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [{ type: "uint128" }],
  },
] as const;

export const SHIELDED_SWAP_V4_STATE_VIEW =
  "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b" as Address;
export const SHIELDED_SWAP_V4_POOL_ID =
  "0x3524d46204a0438a67c94e9795818b3b0c5d59869d28865754c4254eb05442e1" as `0x${string}`;

export interface ShieldedPoolLiveState {
  address: Address;
  denomination: bigint;
  asset: Address;
  paused: boolean;
}

/** Live onchain read of one pool's gate-relevant state. Throws on RPC failure. */
export async function readShieldedPoolLive(
  client: PublicClient,
  pool: Address
): Promise<ShieldedPoolLiveState> {
  const [denomination, asset, paused] = await Promise.all([
    client.readContract({
      address: pool,
      abi: SHIELDED_POOL_LIVE_ABI,
      functionName: "denomination",
    }),
    client.readContract({
      address: pool,
      abi: SHIELDED_POOL_LIVE_ABI,
      functionName: "asset",
    }),
    client.readContract({
      address: pool,
      abi: SHIELDED_POOL_LIVE_ABI,
      functionName: "depositsPaused",
    }),
  ]);
  return { address: pool, denomination, asset, paused };
}

export interface ShieldedSwapLiveStatus {
  executable: boolean;
  pools: ShieldedPoolLiveState[];
  unpausedCount: number;
  v4Liquidity: bigint;
  routeQuoteOut: bigint | null;
  reason: string | null;
}

export interface ShieldedSwapLiveOptions {
  pools?: readonly Address[];
  /** Live route check reusing the T2 quote path (quoteSwapToShieldOutput with
   *  a funded account). When omitted, v4 getLiquidity > 0 is the route check.
   *  A quoter revert (e.g. missing VEIL/allowance) fails closed. */
  quoteRouteOutput?: () => Promise<bigint>;
  /** Destination denomination the route output must fund. */
  destDenomination?: bigint;
}

/**
 * LIVE gate: executable only with >= 2 unpaused pools onchain plus a liquid
 * v4 route. executable is DERIVED from these reads every call — never stored
 * or hardcoded. reason carries the honest English why-not when false.
 */
export async function readShieldedSwapRouteStatusLive(
  client: PublicClient,
  options?: ShieldedSwapLiveOptions
): Promise<ShieldedSwapLiveStatus> {
  const inventory = options?.pools ?? KNOWN_TESTNET_LEGACY_POOLS;
  const pools = await Promise.all(
    inventory.map((pool) => readShieldedPoolLive(client, pool))
  );
  const unpausedCount = pools.filter((p) => !p.paused).length;
  if (unpausedCount < 2) {
    return {
      executable: false,
      pools,
      unpausedCount,
      v4Liquidity: 0n,
      routeQuoteOut: null,
      reason:
        `Only ${unpausedCount} unpaused shielded pool(s) live on testnet 46630; ` +
        `shielded swap needs at least 2. No transaction was built.`,
    };
  }
  const v4Liquidity = (await client.readContract({
    address: SHIELDED_SWAP_V4_STATE_VIEW,
    abi: V4_STATE_VIEW_ABI,
    functionName: "getLiquidity",
    args: [SHIELDED_SWAP_V4_POOL_ID],
  })) as bigint;
  if (options?.quoteRouteOutput) {
    let quote: bigint;
    try {
      quote = await options.quoteRouteOutput();
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160);
      return {
        executable: false,
        pools,
        unpausedCount,
        v4Liquidity,
        routeQuoteOut: null,
        reason:
          `Live route quote failed (${detail}). Fund test VEIL / approve the router and try again. ` +
          `No transaction was built.`,
      };
    }
    const floor = options.destDenomination ?? 1n;
    const viable = quote >= floor && v4Liquidity > 0n;
    return {
      executable: viable,
      pools,
      unpausedCount,
      v4Liquidity,
      routeQuoteOut: quote,
      reason: viable
        ? null
        : `Live route quote is ${quote} wei against the ${floor} wei destination note floor ` +
          `(v4 liquidity ${v4Liquidity}); the route cannot fund a destination note right now. ` +
          `No transaction was built.`,
    };
  }
  return {
    executable: v4Liquidity > 0n,
    pools,
    unpausedCount,
    v4Liquidity,
    routeQuoteOut: null,
    reason:
      v4Liquidity > 0n
        ? null
        : "The v4 ETH/VEIL route has no liquidity right now. No transaction was built.",
  };
}

export type { ShieldedSwapExecutionParams };
export type { Hash };

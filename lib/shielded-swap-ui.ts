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
// - Testnet deploys exactly ONE legacy pool (ShieldedPool_ETH in
//   deployments/testnet-latest.json), so no distinct poolDestination exists:
//   the tab renders the planned route plus an honest "destination pool
//   pending" state (R3 feasibility exit).
// ---------------------------------------------------------------------------

import type { Address, Hash } from "viem";
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
  TESTNET_SHIELD_DENOMINATION,
} from "./router-swap";
import type { ShieldedNote } from "./note";

export const SHIELDED_SWAP_CHAIN_ID = TESTNET_CHAIN_ID;
export const SHIELDED_SWAP_ROUTER = TESTNET_ROUTER_ADDRESS;
export const SHIELDED_SWAP_SOURCE_POOL = TESTNET_LEGACY_ETH_POOL;
export const SHIELDED_SWAP_SOURCE_DENOMINATION = TESTNET_SHIELD_DENOMINATION;
export const SHIELDED_SWAP_EXPLORER_TX_BASE = TESTNET_EXPLORER_TX_BASE;

// Proven-liquid v4 route, verbatim from scripts/shielded-swap-v2.mjs leg 3
// (ETH -> VEIL, fee 3000, tickSpacing 60, no hooks). The v2 script proves this
// poolKey has liquidity; the router path itself is unproven (see above).
export const SHIELDED_SWAP_POOL_KEY: PoolKey = {
  currency0: TESTNET_ROUTER_POOL_KEY.currency0,
  currency1: TESTNET_ROUTER_POOL_KEY.currency1,
  fee: TESTNET_ROUTER_POOL_KEY.fee,
  tickSpacing: TESTNET_ROUTER_POOL_KEY.tickSpacing,
  hooks: TESTNET_ROUTER_POOL_KEY.hooks,
} as const;

// Source note is shielded ETH, so the swap leg sells ETH (currency0) for VEIL.
export const SHIELDED_SWAP_ZERO_FOR_ONE = true as const;

// Legacy Veil ShieldedPool inventory on testnet 46630. Mirrors
// deployments/testnet-latest.json, which deploys ONLY ShieldedPool_ETH.
// When a second-asset pool (e.g. ShieldedPool_VEIL) is deployed, append its
// address here and the tab enables automatically — no other change needed.
export const KNOWN_TESTNET_LEGACY_POOLS: readonly Address[] = [
  TESTNET_LEGACY_ETH_POOL,
] as const;

export const SHIELDED_SWAP_MISSING_POOL_LABEL =
  "ShieldedPool_VEIL (second-asset legacy pool)" as const;

/**
 * Resolves a distinct destination pool for the swap. Returns null while no
 * second legacy pool exists on testnet (R3 gating). A same-pool "swap" is
 * never returned: swapping an asset into itself has no v4 route and cannot
 * fund a new-denomination note.
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
 * Single source of truth for the ShieldedSwap tab state. While the
 * destination pool is missing this reports executable: false with the exact
 * specifics the UI renders and the report returns (R3 honest exit).
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
}

/**
 * Thin self-relay wrapper over the parallel agent's buildShieldedSwapParams
 * (reused, never reimplemented). Binds relayerFee to 0 and fails closed when
 * the destination pool is still pending, so no params can be built for a
 * swap that cannot settle. minAmountOut always derives from the live quote ×
 * user slippage — never hardcoded.
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
    poolDestination: args.poolDestination,
    quotedAmountOut: args.quotedAmountOut,
    slippagePercent: args.slippagePercent,
    relayerFee: 0n,
    newCommitment: args.newCommitment,
    hookData: args.hookData,
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

export type { ShieldedSwapExecutionParams };
export type { Hash };

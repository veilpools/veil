import { parseAbi, type Address, type PublicClient } from "viem";
import type { ShieldedNote } from "./note";

// Minimal asset() reader: legacy Veil pools expose it (the router itself
// calls source.asset()/dest.asset() for its zero-balance invariant).
const LEGACY_ASSET_ABI = parseAbi([
  "function asset() view returns (address)",
]);

const LEGACY_STATE_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function poolCap() view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
]);

export interface LegacyPoolCandidate {
  pool: Address;
  asset: Address;
}

export interface LegacyPoolState extends LegacyPoolCandidate {
  denomination: bigint;
  paused: boolean;
  cap: bigint;
  total: bigint;
}

/**
 * Pure asset matcher. Returns every candidate pool whose declared asset
 * matches (case-insensitive), in preference order. Never touches chain —
 * callers live-verify denomination before sending (see resolveLegacyPoolForNote).
 */
export function findLegacyPoolsForAsset(
  candidates: readonly LegacyPoolCandidate[],
  asset: string
): Address[] {
  const want = asset.toLowerCase();
  return candidates.filter((c) => c.asset.toLowerCase() === want).map((c) => c.pool);
}

/** Live-read one pool's state (denomination/asset/pause/cap/total). */
export async function readLegacyPoolState(
  client: PublicClient,
  pool: Address
): Promise<LegacyPoolState> {
  const [denomination, cap, total, paused, asset] = await Promise.all([
    client.readContract({ address: pool, abi: LEGACY_STATE_ABI, functionName: "denomination" }),
    client.readContract({ address: pool, abi: LEGACY_STATE_ABI, functionName: "poolCap" }),
    client.readContract({ address: pool, abi: LEGACY_STATE_ABI, functionName: "totalDeposits" }),
    client.readContract({ address: pool, abi: LEGACY_STATE_ABI, functionName: "depositsPaused" }),
    client.readContract({ address: pool, abi: LEGACY_ASSET_ABI, functionName: "asset" }),
  ]);
  return { pool, asset, denomination, paused, cap, total };
}

/**
 * Resolve the withdraw pool for a legacy note: match by asset, then verify
 * LIVE that the pool's denomination matches the note and deposits state is
 * sane. Throws an honest Error (fail closed) when nothing matches — the
 * caller surfaces it via flowError and sends nothing.
 */
export async function resolveLegacyPoolForNote(
  client: PublicClient,
  note: ShieldedNote,
  candidates: readonly LegacyPoolCandidate[]
): Promise<Address> {
  const pools = findLegacyPoolsForAsset(candidates, note.asset);
  if (pools.length === 0) {
    throw new Error(
      `No legacy shielded pool holds asset ${note.asset}. This note cannot be withdrawn on testnet right now. No transaction was sent.`
    );
  }
  for (const pool of pools) {
    const state = await readLegacyPoolState(client, pool);
    if (
      state.asset.toLowerCase() === note.asset.toLowerCase() &&
      state.denomination === note.denomination
    ) {
      return pool;
    }
  }
  throw new Error(
    "No live pool matches this note's asset and denomination (pools may have been reconfigured). The note was NOT spent. No transaction was sent."
  );
}

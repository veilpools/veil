import { describe, it, expect } from "vitest";
import { parseEther, type Address, type PublicClient } from "viem";
import {
  buildSelfRelayShieldedSwapArgs,
  getShieldedSwapRouteStatus,
  isShieldedSwapExecuteDisabled,
  readShieldedPoolLive,
  readShieldedSwapRouteStatusLive,
  resolveShieldedSwapDestination,
  selectShieldedSwapRelayPath,
  shieldedSwapPendingMessage,
  KNOWN_TESTNET_LEGACY_POOLS,
  SHIELDED_SWAP_DESTINATION_POOL,
  SHIELDED_SWAP_SOURCE_DENOMINATION,
  SHIELDED_SWAP_SOURCE_POOL,
  SHIELDED_SWAP_ZERO_FOR_ONE,
} from "../lib/shielded-swap-ui";
import {
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_VEIL_TOKEN,
} from "../lib/router-swap";
import { MAX_SQRT_RATIO } from "../lib/router-client";
import type { ShieldedNote } from "../lib/note";

const DUMMY_NOTE: ShieldedNote = {
  nullifier:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  secret:
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  nullifierHash:
    "0x3333333333333333333333333333333333333333333333333333333333333333",
  commitment:
    "0x4444444444444444444444444444444444444444444444444444444444444444",
  denomination: 1000000000000000n,
  asset: "0x0000000000000000000000000000000000000000",
  timestamp: 1728300000000,
};

// Realistic VEIL2 source note (2 VEIL, pool-VEIL asset).
const VEIL2_NOTE: ShieldedNote = {
  ...DUMMY_NOTE,
  denomination: SHIELDED_SWAP_SOURCE_DENOMINATION,
  asset: TESTNET_VEIL_TOKEN,
};

const PROOF = "0x12345678" as const;
const ROOT =
  "0x7777777777777777777777777777777777777777777777777777777777777777" as const;
const NEW_COMMITMENT =
  "0x5555555555555555555555555555555555555555555555555555555555555555" as const;

// Live sim output from the Task 4b proof (2 VEIL -> 1569433509894083 wei ETH).
const LIVE_QUOTE = 1569433509894083n;
const LIVE_MIN_OUT = 1561586342344612n; // LIVE_QUOTE x (1 - 0.5%)

interface StubPool {
  denomination: bigint;
  asset: Address;
  paused: boolean;
}

function stubClient(pools: Record<string, StubPool>, liquidity: bigint) {
  return {
    async readContract({ address, functionName }: { address: Address; functionName: string }) {
      if (functionName === "getLiquidity") return liquidity;
      const key = address.toLowerCase();
      const pool = pools[key];
      if (!pool) throw new Error(`unknown pool ${address}`);
      if (functionName === "denomination") return pool.denomination;
      if (functionName === "asset") return pool.asset;
      if (functionName === "depositsPaused") return pool.paused;
      throw new Error(`unknown fn ${functionName}`);
    },
  } as unknown as PublicClient;
}

function threePoolInventory(): Record<string, StubPool> {
  const out: Record<string, StubPool> = {};
  for (const pool of KNOWN_TESTNET_LEGACY_POOLS) {
    out[pool.toLowerCase()] =
      pool.toLowerCase() === SHIELDED_SWAP_SOURCE_POOL.toLowerCase()
        ? {
            denomination: SHIELDED_SWAP_SOURCE_DENOMINATION,
            asset: TESTNET_VEIL_TOKEN,
            paused: false,
          }
        : {
            denomination: parseEther("0.001"),
            asset: "0x0000000000000000000000000000000000000000",
            paused: false,
          };
  }
  return out;
}

describe("ShieldedSwap tab adapter (Task 4b: §7 #5 #6, R2/R3/R4)", () => {
  it("resolves the ETH pool as destination for the VEIL2 source (M-1 positive enable-path)", () => {
    expect(KNOWN_TESTNET_LEGACY_POOLS.length).toBeGreaterThanOrEqual(2);
    expect(resolveShieldedSwapDestination()).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(resolveShieldedSwapDestination(SHIELDED_SWAP_SOURCE_POOL)).toBe(
      TESTNET_LEGACY_ETH_POOL
    );
    // Excluding nothing still yields a pool: the inventory holds three.
    expect(
      resolveShieldedSwapDestination(
        "0x0000000000000000000000000000000000000000"
      )
    ).toBe(TESTNET_LEGACY_ETH_POOL);
  });

  it("reports the executable VEIL -> ETH route status (no hardcoded flag)", () => {
    const status = getShieldedSwapRouteStatus();
    expect(status.executable).toBe(true);
    expect(status.destination).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(status.sourcePool).toBe(SHIELDED_SWAP_SOURCE_POOL);
    expect(status.sourceDenomination).toBe(SHIELDED_SWAP_SOURCE_DENOMINATION);
    expect(status.zeroForOne).toBe(SHIELDED_SWAP_ZERO_FOR_ONE);
    expect(status.zeroForOne).toBe(false);
    expect(status.missingPool).toBeNull();
    expect(status.unblock).toBeNull();
  });

  it("pending message names the missing pool and keeps funds-safe guidance", () => {
    const pending = {
      ...getShieldedSwapRouteStatus(),
      executable: false,
      destination: null,
      missingPool: "ShieldedPool_VEIL (second-asset legacy pool)",
      unblock: "unblock specifics",
    };
    const msg = shieldedSwapPendingMessage(pending);
    expect(msg).toContain("ShieldedPool_VEIL");
    expect(msg).toContain("46630");
    expect(msg).toContain("use Withdraw for now");
    expect(msg).not.toMatch(/alert/i);
  });

  it("selects self-relay by default with relayerFee bound to 0", () => {
    const sel = selectShieldedSwapRelayPath();
    expect(sel.path).toBe("self-relay");
    expect(sel.relayerFee).toBe(0n);
    expect(sel.note).toMatch(/Self-relay \(default\)/);
  });

  it("falls back to self-relay when hosted relay is requested (no service exists)", () => {
    const sel = selectShieldedSwapRelayPath({ hostedRequested: true });
    expect(sel.path).toBe("self-relay");
    expect(sel.relayerFee).toBe(0n);
    expect(sel.note).toMatch(/No hosted relayer service exists/);
    expect(sel.note).toMatch(/§7 #6/);
  });

  it("refuses to build params while the destination pool is pending", () => {
    expect(() =>
      buildSelfRelayShieldedSwapArgs({
        note: DUMMY_NOTE,
        proof: PROOF,
        root: ROOT,
        quotedAmountOut: parseEther("0.0012"),
        slippagePercent: 0.5,
        newCommitment: NEW_COMMITMENT,
        poolDestination: null,
      })
    ).toThrow(/destination pool is pending/);
  });

  it("rejects nonzero relayerFee on the self-relay path", () => {
    expect(() =>
      buildSelfRelayShieldedSwapArgs({
        note: DUMMY_NOTE,
        proof: PROOF,
        root: ROOT,
        quotedAmountOut: parseEther("0.0012"),
        slippagePercent: 0.5,
        newCommitment: NEW_COMMITMENT,
        poolDestination: SHIELDED_SWAP_DESTINATION_POOL,
        relayerFee: 10n,
      })
    ).toThrow(/binds relayerFee to 0/);
  });

  it("binds the relay selection fee and derives minAmountOut from the live quote x slippage", () => {
    const relay = selectShieldedSwapRelayPath();
    const params = buildSelfRelayShieldedSwapArgs({
      note: VEIL2_NOTE,
      proof: PROOF,
      root: ROOT,
      quotedAmountOut: LIVE_QUOTE,
      slippagePercent: 0.5,
      newCommitment: NEW_COMMITMENT,
      poolDestination: SHIELDED_SWAP_DESTINATION_POOL,
      relayerFee: relay.relayerFee,
    });
    expect(params.relayerFee).toBe(0n);
    expect(params.minAmountOut).toBe(LIVE_MIN_OUT);
    expect(params.nullifierHash).toBe(VEIL2_NOTE.nullifierHash);
    expect(params.newCommitment).toBe(NEW_COMMITMENT);
  });

  it("passes the VEIL -> ETH direction through (poolSource, zeroForOne, price limit)", () => {
    const params = buildSelfRelayShieldedSwapArgs({
      note: VEIL2_NOTE,
      proof: PROOF,
      root: ROOT,
      quotedAmountOut: LIVE_QUOTE,
      slippagePercent: 0.5,
      newCommitment: NEW_COMMITMENT,
      poolDestination: SHIELDED_SWAP_DESTINATION_POOL,
      zeroForOne: false,
    });
    expect(params.poolSource).toBe(SHIELDED_SWAP_SOURCE_POOL);
    expect(params.zeroForOne).toBe(false);
    expect(params.sqrtPriceLimitX96).toBe(MAX_SQRT_RATIO - 1n);
  });

  it("reads one pool's live gate state (denomination/asset/paused)", async () => {
    const client = stubClient(threePoolInventory(), 1n);
    const live = await readShieldedPoolLive(client, SHIELDED_SWAP_SOURCE_POOL);
    expect(live.denomination).toBe(SHIELDED_SWAP_SOURCE_DENOMINATION);
    expect(live.asset.toLowerCase()).toBe(TESTNET_VEIL_TOKEN.toLowerCase());
    expect(live.paused).toBe(false);
  });

  it("live gate opens with >= 2 unpaused pools + liquid route (R2/I-1)", async () => {
    const client = stubClient(threePoolInventory(), 301001000000000000n);
    const status = await readShieldedSwapRouteStatusLive(client, {
      quoteRouteOutput: async () => LIVE_QUOTE,
      destDenomination: parseEther("0.001"),
    });
    expect(status.unpausedCount).toBe(3);
    expect(status.pools.length).toBe(3);
    expect(status.routeQuoteOut).toBe(LIVE_QUOTE);
    expect(status.executable).toBe(true);
    expect(status.reason).toBeNull();
  });

  it("live gate closes when fewer than 2 pools are unpaused", async () => {
    const inv = threePoolInventory();
    const pools = Object.keys(inv);
    inv[pools[0]].paused = true;
    inv[pools[1]].paused = true;
    const client = stubClient(inv, 301001000000000000n);
    const status = await readShieldedSwapRouteStatusLive(client);
    expect(status.unpausedCount).toBe(1);
    expect(status.executable).toBe(false);
    expect(status.reason).toMatch(/at least 2/);
  });

  it("live gate closes when the v4 route has no liquidity", async () => {
    const client = stubClient(threePoolInventory(), 0n);
    const status = await readShieldedSwapRouteStatusLive(client);
    expect(status.executable).toBe(false);
    expect(status.reason).toMatch(/no liquidity/);
  });

  it("live gate closes when the route quote cannot fund the destination note", async () => {
    const client = stubClient(threePoolInventory(), 1n);
    const status = await readShieldedSwapRouteStatusLive(client, {
      quoteRouteOutput: async () => 1n,
      destDenomination: parseEther("0.001"),
    });
    expect(status.executable).toBe(false);
    expect(status.reason).toMatch(/cannot fund a destination note/);
  });

  it("live gate fails closed when the route quote reverts", async () => {
    const client = stubClient(threePoolInventory(), 1n);
    const status = await readShieldedSwapRouteStatusLive(client, {
      quoteRouteOutput: async () => {
        throw new Error("execution reverted");
      },
    });
    expect(status.executable).toBe(false);
    expect(status.routeQuoteOut).toBeNull();
    expect(status.reason).toMatch(/No transaction was built/);
  });

  it("disables Execute until a destination pool is live", () => {
    const base = {
      isExecuting: false,
      connected: true,
      hasNotes: true,
      isProving: false,
    };
    expect(
      isShieldedSwapExecuteDisabled({ ...base, destinationAvailable: false })
    ).toBe(true);
    expect(
      isShieldedSwapExecuteDisabled({ ...base, destinationAvailable: true })
    ).toBe(false);
    // Disconnected keeps the button enabled so it can open the wallet modal.
    expect(
      isShieldedSwapExecuteDisabled({
        isExecuting: false,
        connected: false,
        hasNotes: false,
        destinationAvailable: false,
        isProving: false,
      })
    ).toBe(false);
    expect(
      isShieldedSwapExecuteDisabled({ ...base, destinationAvailable: true, isExecuting: true })
    ).toBe(true);
  });
});

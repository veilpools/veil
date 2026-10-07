import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import {
  buildSelfRelayShieldedSwapArgs,
  getShieldedSwapRouteStatus,
  isShieldedSwapExecuteDisabled,
  resolveShieldedSwapDestination,
  selectShieldedSwapRelayPath,
  shieldedSwapPendingMessage,
  SHIELDED_SWAP_SOURCE_POOL,
  SHIELDED_SWAP_ZERO_FOR_ONE,
} from "../lib/shielded-swap-ui";
import { TESTNET_LEGACY_ETH_POOL } from "../lib/router-swap";
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

const PROOF = "0x12345678" as const;
const ROOT =
  "0x7777777777777777777777777777777777777777777777777777777777777777" as const;
const NEW_COMMITMENT =
  "0x5555555555555555555555555555555555555555555555555555555555555555" as const;

describe("ShieldedSwap tab adapter (Task 4: §7 #5 #6, R3/R6)", () => {
  it("gates execution: no distinct destination pool exists on testnet", () => {
    expect(resolveShieldedSwapDestination()).toBeNull();
    // Excluding nothing still yields null: only one legacy pool is known.
    expect(
      resolveShieldedSwapDestination(
        "0x0000000000000000000000000000000000000000"
      )
    ).toBe(TESTNET_LEGACY_ETH_POOL);
  });

  it("reports the honest pending route status with unblock specifics", () => {
    const status = getShieldedSwapRouteStatus();
    expect(status.executable).toBe(false);
    expect(status.destination).toBeNull();
    expect(status.sourcePool).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(status.sourceDenomination).toBe(1000000000000000n);
    expect(status.zeroForOne).toBe(SHIELDED_SWAP_ZERO_FOR_ONE);
    expect(status.missingPool).toMatch(/ShieldedPool_VEIL/);
    expect(status.unblock).toMatch(/Deploy a VEIL-denominated legacy ShieldedPool/);
    expect(status.unblock).toMatch(/KNOWN_TESTNET_LEGACY_POOLS/);
  });

  it("pending message names the missing pool and keeps funds-safe guidance", () => {
    const msg = shieldedSwapPendingMessage(getShieldedSwapRouteStatus());
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
        poolDestination: SHIELDED_SWAP_SOURCE_POOL,
        relayerFee: 10n,
      })
    ).toThrow(/binds relayerFee to 0/);
  });

  it("binds relayerFee 0 and derives minAmountOut from live quote x slippage", () => {
    const params = buildSelfRelayShieldedSwapArgs({
      note: DUMMY_NOTE,
      proof: PROOF,
      root: ROOT,
      quotedAmountOut: parseEther("0.0012"),
      slippagePercent: 0.5,
      newCommitment: NEW_COMMITMENT,
      poolDestination: SHIELDED_SWAP_SOURCE_POOL,
    });
    expect(params.relayerFee).toBe(0n);
    expect(params.minAmountOut).toBe(parseEther("0.001194"));
    expect(params.nullifierHash).toBe(DUMMY_NOTE.nullifierHash);
    expect(params.newCommitment).toBe(NEW_COMMITMENT);
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

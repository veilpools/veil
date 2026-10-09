import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createShieldedNote } from "../lib/note";
import { getWithdrawPath } from "../lib/note";
import { buildWithdrawArgs, LEGACY_MOCK_PROOF } from "../lib/withdraw-args";

function readSrc(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

// (a) No direct-deposit call exists for legacy pools.
describe("ui cutover: no legacy direct-deposit path", () => {
  it("app/trade/page.tsx has no forceDirect toggle or legacy direct-deposit ABI", () => {
    const src = readSrc("app/trade/page.tsx");
    expect(src).not.toContain("forceDirect");
    expect(src).not.toContain("POOL_DEPOSIT_ABI");
    expect(src).not.toContain("Direct ShieldedPool deposit");
  });

  it("BuyAndShieldPanel has no direct-deposit fallback toggle", () => {
    const src = readSrc("components/trade/BuyAndShieldPanel.tsx");
    expect(src).not.toContain("forceDirect");
    expect(src).not.toContain("Direct ShieldedPool deposit");
    expect(src).not.toContain("Legacy Mock Proof Payload");
  });
});

// (b) VEIL approve gate blocks without allowance.
describe("ui cutover: VEIL approve gate", () => {
  it("throws fail-closed when allowance is below the deposit value", async () => {
    const { assertVeilAllowanceForBowDeposit } = await import("../lib/0xbow-client");
    expect(() =>
      assertVeilAllowanceForBowDeposit(0n, 1000000000000000n)
    ).toThrow(/approve/i);
  });

  it("passes when allowance covers the deposit value", async () => {
    const { assertVeilAllowanceForBowDeposit } = await import("../lib/0xbow-client");
    expect(() =>
      assertVeilAllowanceForBowDeposit(1000000000000000n, 1000000000000000n)
    ).not.toThrow();
  });

  it("builds a VEIL relay context against the v3 veilPool, not the ETH pool", async () => {
    const { buildBowRelayContext } = await import("../lib/0xbow-client");
    const { TESTNET_BOW_V3_VEIL_POOL, TESTNET_BOW_V3_ETH_POOL } = await import(
      "../lib/privacy-pools"
    );
    const ctx = buildBowRelayContext({
      pool: TESTNET_BOW_V3_VEIL_POOL,
      asset: "0x019086f63407fadf0ccb89516e465baef5031aa9",
      recipient: "0x000000000000000000000000000000000000dEaD",
    });
    expect(ctx.pool.toLowerCase()).toBe(TESTNET_BOW_V3_VEIL_POOL.toLowerCase());
    expect(ctx.pool.toLowerCase()).not.toBe(TESTNET_BOW_V3_ETH_POOL.toLowerCase());
  });
});

// (c) Old-note exit still routed legacy.
describe("ui cutover: old-note exit stays legacy", () => {
  it("routes legacy keccak notes to the legacy path with the Mock proof", () => {
    const note = createShieldedNote(1000000000000000n);
    expect(getWithdrawPath(note)).toBe("legacy");
    const root = ("0x" + "ab".repeat(32)) as `0x${string}`;
    const args = buildWithdrawArgs(
      note,
      root,
      "0x1111111111111111111111111111111111111111" as `0x${string}`
    );
    expect(args.proof).toBe(LEGACY_MOCK_PROOF);
  });

  it("page.tsx keeps the legacy withdraw exit with its old-notes label", () => {
    const src = readSrc("app/trade/page.tsx");
    expect(src).toContain("buildWithdrawArgs");
    expect(src).toMatch(/old notes only/i);
  });
});

// Fresh v3 suite wiring.
describe("ui cutover: v3 0xbow suite wiring", () => {
  it("exposes the fresh suite-v3 entrypoint and pools", async () => {
    const suite = JSON.parse(
      readSrc("deployments/suite-v3-testnet-latest.json")
    );
    const pools = await import("../lib/privacy-pools");
    const v3 = pools as unknown as Record<string, string>;
    expect(v3.TESTNET_BOW_V3_ENTRYPOINT.toLowerCase()).toBe(
      (suite.entrypoint as string).toLowerCase()
    );
    expect(v3.TESTNET_BOW_V3_ETH_POOL.toLowerCase()).toBe(
      (suite.ethPool as string).toLowerCase()
    );
    expect(v3.TESTNET_BOW_V3_VEIL_POOL.toLowerCase()).toBe(
      (suite.veilPool as string).toLowerCase()
    );
  });
});

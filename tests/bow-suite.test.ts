import { describe, it, expect } from "vitest";
import {
  getBowSuite,
  isMainnetBowConfigured,
  isTestnetBowConfigured,
  TESTNET_CHAIN_ID,
  MAINNET_CHAIN_ID,
} from "../lib/privacy-pools";

describe("0xbow suite selector", () => {
  it("selects the testnet suite with live addresses", () => {
    expect(isTestnetBowConfigured()).toBe(true);
    const suite = getBowSuite(TESTNET_CHAIN_ID);
    expect(suite).not.toBeNull();
    expect(suite?.poolEth).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("returns null for mainnet until migration populates env", () => {
    // NEXT_PUBLIC_0XBOW_* unset in test env -> not configured -> null.
    expect(isMainnetBowConfigured()).toBe(false);
    expect(getBowSuite(MAINNET_CHAIN_ID)).toBeNull();
  });

  it("returns null for unknown chains and null input", () => {
    expect(getBowSuite(1)).toBeNull();
    expect(getBowSuite(null)).toBeNull();
  });
});

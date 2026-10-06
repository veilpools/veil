import { describe, it, expect } from "vitest";
import { parseEther, parseUnits } from "viem";
import { getDenominationForToken } from "../lib/denomination";

describe("Pool denomination map", () => {
  it("returns the fixed denomination per token", () => {
    expect(getDenominationForToken("ETH", 18)).toBe(parseEther("0.001"));
    expect(getDenominationForToken("WETH", 18)).toBe(parseEther("0.001"));
    expect(getDenominationForToken("VEIL", 18)).toBe(parseEther("1000"));
    expect(getDenominationForToken("PONS", 18)).toBe(parseEther("1000"));
    expect(getDenominationForToken("QUANTA", 18)).toBe(parseEther("100"));
    expect(getDenominationForToken("USDC", 6)).toBe(parseUnits("100", 6));
    expect(getDenominationForToken("USDT", 6)).toBe(parseUnits("100", 6));
  });
});

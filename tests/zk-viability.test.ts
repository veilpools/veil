import { describe, it, expect } from "vitest";
import { estimateV4SwapOut } from "../lib/zk-router";

// Real v4 slot0 from testnet pool 0x3524..2e1 (ETH/VEIL, fee 3000):
// sqrtPriceX96 = 1052824305957642777749501224688 -> ~176.58 VEIL per ETH.
const SLOT_176 = 1052824305957642777749501224688n;
const ONE = 1000000000000000n; // 0.001 fixed note (both assets)

describe("v4 viability estimator (fail fast before proving)", () => {
  it("passes a viable ETH->VEIL note at healthy prices", () => {
    const out = estimateV4SwapOut({ sqrtPriceX96: SLOT_176, amountIn: ONE, zeroForOne: true });
    expect(out).toBeGreaterThan(ONE); // ~0.167 VEIL >> 0.001 note
  });
  it("rejects a VEIL->ETH dust note that can never fund 0.001 ETH", () => {
    const out = estimateV4SwapOut({ sqrtPriceX96: SLOT_176, amountIn: ONE, zeroForOne: false });
    expect(out).toBeLessThan(ONE); // ~5.6e-6 ETH
  });
  it("rejects zero input without throwing", () => {
    expect(estimateV4SwapOut({ sqrtPriceX96: SLOT_176, amountIn: 0n, zeroForOne: true })).toBe(0n);
  });
  it("applies the haircut against borderline outputs", () => {
    // At exactly 1.0 VEIL/ETH the haircut must push a 0.001 input below the note.
    const two96 = 2n ** 96n;
    const slotOne = two96; // price exactly 1.0
    const out = estimateV4SwapOut({ sqrtPriceX96: slotOne, amountIn: ONE, zeroForOne: true });
    expect(out).toBeLessThan(ONE);
  });
});

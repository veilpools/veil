import { describe, it, expect } from "vitest";
import {
  formatPoolKey,
  calculateSlippageBound,
  encodeHookAttestationData,
} from "../lib/router-client";
import { findSwapToShieldExecuted } from "../lib/router-swap";
import { decodeAbiParameters, encodeAbiParameters, keccak256, pad, parseAbiParameters, parseEther, toHex } from "viem";
import { WANTED_FLAGS, PERMISSION_MASK } from "../scripts/mine-hook.mjs";

describe("Router & Hook Math Verification", () => {
  it("formats PoolKey canonically with sorted currency addresses", () => {
    const tokenA = "0x5555555555555555555555555555555555555555" as const;
    const tokenB = "0x2222222222222222222222222222222222222222" as const;
    const hook = "0x9999999999999999999999999999999999999999" as const;

    const poolKey = formatPoolKey(tokenA, tokenB, hook);

    expect(BigInt(poolKey.currency0) < BigInt(poolKey.currency1)).toBe(true);
    expect(poolKey.currency0).toBe(tokenB);
    expect(poolKey.currency1).toBe(tokenA);
    expect(poolKey.fee).toBe(3000);
    expect(poolKey.tickSpacing).toBe(60);
    expect(poolKey.hooks).toBe(hook);
  });

  it("calculates slippage lower bounds accurately", () => {
    const expected = parseEther("1.0");
    // 0.5% slippage -> 0.995 ETH
    const minOut05 = calculateSlippageBound(expected, 0.5);
    expect(minOut05).toBe(parseEther("0.995"));

    // 1% slippage -> 0.990 ETH
    const minOut10 = calculateSlippageBound(expected, 1.0);
    expect(minOut10).toBe(parseEther("0.99"));

    // 5% slippage -> 0.950 ETH
    const minOut50 = calculateSlippageBound(expected, 5.0);
    expect(minOut50).toBe(parseEther("0.95"));
  });

  it("rejects out-of-range slippage instead of flooring minOut to 0", () => {
    const expected = parseEther("1.0");
    expect(() => calculateSlippageBound(expected, 100)).toThrow(RangeError);
    expect(() => calculateSlippageBound(expected, 150)).toThrow(RangeError);
    expect(() => calculateSlippageBound(expected, -1)).toThrow(RangeError);
    expect(() => calculateSlippageBound(expected, Number.NaN)).toThrow(RangeError);
    // Boundary stays valid: just under 100% still yields a positive bound.
    expect(calculateSlippageBound(expected, 99.99)).toBeGreaterThan(0n);
  });

  it("event finder optionally matches the swapper (M-4 hardening)", () => {
    const swapper = "0x1111111111111111111111111111111111111111" as const;
    const other = "0x2222222222222222222222222222222222222222" as const;
    const pool = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17" as const;
    const commitment =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    // Manual log encoding (this viem build has no encodeEventLog):
    // SwapToShieldExecuted(address,address,bytes32,uint256,uint256), first
    // three params indexed.
    const topics = [
      keccak256(
        toHex("SwapToShieldExecuted(address,address,bytes32,uint256,uint256)")
      ),
      pad(swapper),
      pad(pool),
      commitment,
    ] as readonly `0x${string}`[];
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [100n, 200n]
    );
    const logs = [{ data, topics }];
    // No filter: commitment match suffices (backward compatible).
    expect(findSwapToShieldExecuted(logs, commitment)?.swapper.toLowerCase()).toBe(
      swapper.toLowerCase()
    );
    // Matching swapper passes; another address is rejected (fail closed).
    expect(
      findSwapToShieldExecuted(logs, commitment, swapper)?.amountOut
    ).toBe(200n);
    expect(findSwapToShieldExecuted(logs, commitment, other)).toBeNull();
  });

  it("encodes and decodes hook attestation data correctly", () => {    const user = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d" as const;
    const encoded = encodeHookAttestationData(user);

    const [decoded] = decodeAbiParameters(parseAbiParameters("address user"), encoded);
    expect(decoded.toLowerCase()).toBe(user.toLowerCase());
  });

  it("verifies Uniswap v4 Hook permission bits configuration", () => {
    // 0x20C4 = beforeInitialize (0x2000) | beforeSwap (0x0080) | afterSwap (0x0040) | afterSwapReturnDelta (0x0004)
    expect(WANTED_FLAGS).toBe(0x20c4n);
    expect(PERMISSION_MASK).toBe(0x3fffn);

    const beforeInitialize = 1n << 13n;
    const beforeSwap = 1n << 7n;
    const afterSwap = 1n << 6n;
    const afterSwapReturnDelta = 1n << 2n;

    const expected = beforeInitialize | beforeSwap | afterSwap | afterSwapReturnDelta;
    expect(expected).toBe(WANTED_FLAGS);
  });
});

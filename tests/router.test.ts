import { describe, it, expect } from "vitest";
import {
  formatPoolKey,
  calculateSlippageBound,
  encodeHookAttestationData,
} from "../lib/router-client";
import { decodeAbiParameters, parseAbiParameters, parseEther } from "viem";
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

  it("encodes and decodes hook attestation data correctly", () => {
    const user = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d" as const;
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

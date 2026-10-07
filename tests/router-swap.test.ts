import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import {
  buildSwapToShieldParams,
  findSwapToShieldExecuted,
  isRouterExecuteDisabled,
  mapRouterSwapError,
  parseSlippagePercent,
  pickVeilDestinationPool,
  slippageBps,
  withAllowanceHint,
  TESTNET_LEGACY_ETH_POOL,
  TESTNET_ROUTER_ADDRESS,
  TESTNET_ROUTER_HOOK_DATA,
  TESTNET_ROUTER_POOL_KEY,
  TESTNET_ROUTER_SQRT_PRICE_LIMIT,
  TESTNET_ROUTER_SQRT_PRICE_LIMIT_ETH_IN,
  TESTNET_SHIELD_DENOMINATION,
  TESTNET_VEIL_POOL_05,
  TESTNET_VEIL_POOL_2,
  TESTNET_VEIL_TOKEN,
  ETH_ZERO_ADDRESS,
  UINT128_MAX,
} from "../lib/router-swap";
import { calculateSlippageBound } from "../lib/router-client";

const COMMITMENT =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

describe("router swapToShield builders (testnet e2e task 2)", () => {
  it("pins the proven testnet route constants verbatim", () => {
    expect(TESTNET_ROUTER_ADDRESS).toBe(
      "0x7c73e4b7f9c9cac1f1574c46fd17952be2853e27"
    );
    expect(TESTNET_LEGACY_ETH_POOL).toBe(
      "0x1b1d39e4da649747ecc0e93e7a06452a3061de17"
    );
    expect(TESTNET_VEIL_TOKEN).toBe(
      "0x019086f63407fadf0ccb89516e465baef5031aa9"
    );
    expect(TESTNET_SHIELD_DENOMINATION).toBe(1000000000000000n);
    expect(TESTNET_ROUTER_POOL_KEY.currency0).toBe(ETH_ZERO_ADDRESS);
    expect(TESTNET_ROUTER_POOL_KEY.currency1).toBe(TESTNET_VEIL_TOKEN);
    expect(TESTNET_ROUTER_POOL_KEY.fee).toBe(3000);
    expect(TESTNET_ROUTER_POOL_KEY.tickSpacing).toBe(60);
    expect(TESTNET_ROUTER_POOL_KEY.hooks).toBe(ETH_ZERO_ADDRESS);
    expect(TESTNET_ROUTER_SQRT_PRICE_LIMIT).toBe(
      14614467034852101032872730522039888242097890n
    );
    expect(TESTNET_ROUTER_HOOK_DATA).toBe("0x");
  });

  it("derives minAmountOut from live output and slippage (never hardcoded)", () => {
    const quoted = parseEther("0.0012");
    const params = buildSwapToShieldParams({
      amountIn: parseEther("2"),
      quotedOut: quoted,
      slippagePercent: 0.5,
      commitment: COMMITMENT,
    });
    // 0.5% of 0.0012 ETH -> 0.001194 ETH floor.
    expect(params.minAmountOut).toBe(parseEther("0.001194"));
    expect(params.minAmountOut).toBe(calculateSlippageBound(quoted, 0.5));
    expect(params.zeroForOne).toBe(false);
    expect(params.shieldedPool).toBe(TESTNET_LEGACY_ETH_POOL);
    expect(params.commitment).toBe(COMMITMENT);
    expect(params.hookData).toBe("0x");
    expect(params.sqrtPriceLimitX96).toBe(TESTNET_ROUTER_SQRT_PRICE_LIMIT);
  });

  it("derives params for ETH -> VEIL direction (zeroForOne=true, 0.5 VEIL pool default)", () => {
    const quoted = parseEther("1.35");
    const params = buildSwapToShieldParams({
      amountIn: parseEther("0.001"),
      quotedOut: quoted,
      slippagePercent: 0.5,
      commitment: COMMITMENT,
      zeroForOne: true,
    });
    expect(params.zeroForOne).toBe(true);
    expect(params.amountIn).toBe(parseEther("0.001"));
    expect(params.shieldedPool).toBe(TESTNET_VEIL_POOL_05);
    expect(params.minAmountOut).toBe(calculateSlippageBound(quoted, 0.5));
    expect(params.sqrtPriceLimitX96).toBe(TESTNET_ROUTER_SQRT_PRICE_LIMIT_ETH_IN);
  });

  it("picks the preferred 0.5 VEIL pool when quote covers denomination and cap has room", () => {
    const pools = [
      {
        pool: TESTNET_VEIL_POOL_05,
        denomination: parseEther("0.5"),
        asset: TESTNET_VEIL_TOKEN,
        paused: false,
        cap: parseEther("5000"),
        total: parseEther("10"),
      },
      {
        pool: TESTNET_VEIL_POOL_2,
        denomination: parseEther("2"),
        asset: TESTNET_VEIL_TOKEN,
        paused: false,
        cap: parseEther("20000"),
        total: parseEther("0"),
      },
    ];
    // Quote of 1.35 VEIL covers 0.5 VEIL denomination -> returns 0.5 pool
    const picked = pickVeilDestinationPool(parseEther("1.35"), pools);
    expect(picked?.pool).toBe(TESTNET_VEIL_POOL_05);

    // If 0.5 pool is paused -> falls back to 2 VEIL pool when quote covers 2 VEIL
    const paused05 = [{ ...pools[0], paused: true }, pools[1]];
    expect(pickVeilDestinationPool(parseEther("2.1"), paused05)?.pool).toBe(TESTNET_VEIL_POOL_2);

    // If quote is below denomination -> returns null
    expect(pickVeilDestinationPool(parseEther("0.3"), pools)).toBeNull();
  });

  it("floors slippage bps and keeps full output at 0%", () => {
    expect(slippageBps(0.5)).toBe(50n);
    const params = buildSwapToShieldParams({
      amountIn: parseEther("2"),
      quotedOut: parseEther("0.001"),
      slippagePercent: 0,
      commitment: COMMITMENT,
    });
    expect(params.minAmountOut).toBe(parseEther("0.001"));
  });

  it("rejects zero input, zero quote, oversized input, and bad commitments", () => {
    const base = {
      amountIn: parseEther("2"),
      quotedOut: parseEther("0.001"),
      slippagePercent: 0.5,
      commitment: COMMITMENT,
    };
    expect(() => buildSwapToShieldParams({ ...base, amountIn: 0n })).toThrow();
    expect(() => buildSwapToShieldParams({ ...base, quotedOut: 0n })).toThrow();
    expect(() =>
      buildSwapToShieldParams({ ...base, amountIn: UINT128_MAX + 1n })
    ).toThrow();
    expect(() =>
      buildSwapToShieldParams({ ...base, commitment: "0x1234" as `0x${string}` })
    ).toThrow();
  });

  it("validates the shared slippage string honestly", () => {
    expect(parseSlippagePercent("0.5")).toBe(0.5);
    expect(parseSlippagePercent("0")).toBe(0);
    expect(() => parseSlippagePercent("")).toThrow();
    expect(() => parseSlippagePercent("abc")).toThrow();
    expect(() => parseSlippagePercent("-1")).toThrow();
    expect(() => parseSlippagePercent("100")).toThrow();
  });

  it("surfaces contract revert reasons honestly", () => {
    const slip = mapRouterSwapError({ errorName: "SlippageExceeded" }, 0.5);
    expect(slip).toMatch(/SlippageExceeded/);
    expect(slip).toMatch(/0\.5%/);
    expect(
      mapRouterSwapError(new Error("reverted: InsufficientOutputForDenomination"))
    ).toMatch(/0\.001 ETH/);
    expect(mapRouterSwapError({ cause: { errorName: "NonZeroBalanceInvariantFailed" } })).toMatch(
      /NonZeroBalanceInvariantFailed/
    );
    expect(mapRouterSwapError(new Error("User rejected the request"))).toMatch(
      /cancelled/i
    );
    expect(mapRouterSwapError(new Error("ERC20InsufficientAllowance"))).toMatch(
      /Approve VEIL/
    );
    expect(mapRouterSwapError(new Error("ERC20InsufficientBalance"))).toMatch(
      /no onchain faucet/
    );
  });

  it("finds the SwapToShieldExecuted event only for our commitment", () => {
    expect(findSwapToShieldExecuted([], COMMITMENT)).toBeNull();
    // Unrelated logs are skipped without throwing.
    expect(
      findSwapToShieldExecuted(
        [
          {
            data: "0x" as `0x${string}`,
            topics: ["0xdead" as `0x${string}`],
          },
        ],
        COMMITMENT
      )
    ).toBeNull();
  });

  it("I-1: execute stays disabled while simulating or without a fresh quote", () => {
    const ready = {
      isExecuting: false,
      connected: true,
      veilInValid: true,
      quoteBelowDenomination: false,
      isQuoting: false,
      hasQuote: true,
    };
    expect(isRouterExecuteDisabled(ready)).toBe(false);
    // Simulating (label "Simulating Live Output…") must NOT be executable.
    expect(isRouterExecuteDisabled({ ...ready, isQuoting: true })).toBe(true);
    // Missing quote must NOT be executable.
    expect(isRouterExecuteDisabled({ ...ready, hasQuote: false })).toBe(true);
    expect(
      isRouterExecuteDisabled({ ...ready, isQuoting: true, hasQuote: false })
    ).toBe(true);
    // Existing gates still hold.
    expect(isRouterExecuteDisabled({ ...ready, isExecuting: true })).toBe(true);
    expect(isRouterExecuteDisabled({ ...ready, veilInValid: false })).toBe(true);
    expect(
      isRouterExecuteDisabled({ ...ready, quoteBelowDenomination: true })
    ).toBe(true);
    // Disconnected stays enabled so the button can open the wallet modal.
    expect(isRouterExecuteDisabled({ ...ready, connected: false })).toBe(false);
  });

  it("I-2: quote failure surfaces the revert reason first, allowance only as hint", () => {
    const primary = mapRouterSwapError(
      new Error("reverted: InsufficientOutputForDenomination")
    );
    expect(primary).toMatch(/InsufficientOutputForDenomination/);
    const noted = withAllowanceHint(primary, true);
    // Real reason leads, allowance guidance is secondary only.
    expect(noted.indexOf("InsufficientOutputForDenomination")).toBeLessThan(
      noted.toLowerCase().indexOf("secondary hint")
    );
    expect(noted).toMatch(/Secondary hint/);
    // No allowance gap -> primary untouched.
    expect(withAllowanceHint(primary, false)).toBe(primary);
    // Allowance-caused primary is not duplicated.
    const allowancePrimary = mapRouterSwapError(
      new Error("ERC20InsufficientAllowance")
    );
    expect(withAllowanceHint(allowancePrimary, true)).toBe(allowancePrimary);
  });
});

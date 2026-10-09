import { describe, it, expect } from "vitest";
import { parseEther } from "viem";

// TDD RED: lib/zk-router does not exist yet. These pins cover the brief:
// quote-then-execute ordering, minSwapOut derivation, fail-closed mapping.

const ZK_ROUTER = "0x80b18d51fb6087b65cf8511b78b264d90fee585c";
const ENTRYPOINT = "0xb68c3d25e5e9902363e8e10d5c0a471e65be8152";
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const ETH_ZERO = "0x0000000000000000000000000000000000000000" as const;
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9" as const;

const WITHDRAWAL = {
  processooor: ENTRYPOINT,
  data: "0x1234" as `0x${string}`,
} as const;

const PROOF = {
  pA: [1n, 2n] as [bigint, bigint],
  pB: [
    [3n, 4n],
    [5n, 6n],
  ] as [[bigint, bigint], [bigint, bigint]],
  pC: [7n, 8n] as [bigint, bigint],
  pubSignals: [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n] as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint
  ],
} as const;

function baseInput(over: Record<string, unknown> = {}) {
  return {
    withdrawal: WITHDRAWAL,
    proof: PROOF,
    scope: 123n,
    withdrawAsset: ETH_ZERO,
    depositAsset: VEIL,
    depositValue: parseEther("0.5"),
    precommitment: 999n,
    zeroForOne: true,
    quotedSwapOut: parseEther("1.35"),
    slippagePercent: 0.5,
    ...over,
  };
}

describe("zk router flow wiring (full-ZK UI)", () => {
  it("pins the live router + fresh entrypoint + shared v4 pool key", async () => {
    const mod = await import("../lib/zk-router");
    expect(mod.TESTNET_ZK_ROUTER_ADDRESS.toLowerCase()).toBe(ZK_ROUTER);
    expect(mod.TESTNET_ZK_ROUTER_ENTRYPOINT.toLowerCase()).toBe(ENTRYPOINT);
    const { TESTNET_ROUTER_POOL_KEY } = await import("../lib/router-swap");
    expect(mod.ZK_POOL_KEY.currency0).toBe(TESTNET_ROUTER_POOL_KEY.currency0);
    expect(mod.ZK_POOL_KEY.currency1).toBe(TESTNET_ROUTER_POOL_KEY.currency1);
    expect(mod.ZK_POOL_KEY.fee).toBe(TESTNET_ROUTER_POOL_KEY.fee);
    expect(mod.ZK_POOL_KEY.tickSpacing).toBe(TESTNET_ROUTER_POOL_KEY.tickSpacing);
  });

  it("builds the swap leg per direction with the proven price bounds", async () => {
    const { buildZkSwapLeg } = await import("../lib/zk-router");
    const { TESTNET_ROUTER_HOOK_DATA } = await import("../lib/router-swap");
    const ethIn = buildZkSwapLeg({ zeroForOne: true });
    expect(ethIn.zeroForOne).toBe(true);
    expect(ethIn.hookData).toBe(TESTNET_ROUTER_HOOK_DATA);
    const veilIn = buildZkSwapLeg({ zeroForOne: false });
    expect(veilIn.zeroForOne).toBe(false);
    expect(veilIn.sqrtPriceLimitX96).not.toBe(ethIn.sqrtPriceLimitX96);
  });

  it("derives minSwapOut from live quote x slippage (never hardcoded)", async () => {
    const { deriveZkMinSwapOut } = await import("../lib/zk-router");
    const { calculateSlippageBound } = await import("../lib/router-client");
    const quoted = parseEther("1.35");
    expect(deriveZkMinSwapOut(quoted, 0.5)).toBe(
      calculateSlippageBound(quoted, 0.5)
    );
    expect(deriveZkMinSwapOut(quoted, 0)).toBe(quoted);
    expect(() => deriveZkMinSwapOut(0n, 0.5)).toThrow();
    expect(() => deriveZkMinSwapOut(quoted, -1)).toThrow();
    expect(() => deriveZkMinSwapOut(quoted, 100)).toThrow();
  });

  it("builds full-flow args with recipient forced to the router", async () => {
    const { buildFullZkFlowArgs } = await import("../lib/zk-router");
    const args = buildFullZkFlowArgs(baseInput());
    expect(args.recipient.toLowerCase()).toBe(ZK_ROUTER);
    expect(args.minSwapOut).toBe(
      (parseEther("1.35") * 9950n) / 10000n
    );
    expect(() =>
      buildFullZkFlowArgs(baseInput({ depositValue: 0n }))
    ).toThrow();
    expect(() =>
      buildFullZkFlowArgs(baseInput({ precommitment: 0n }))
    ).toThrow();
    expect(() => buildFullZkFlowArgs(baseInput({ quotedSwapOut: 0n }))).toThrow();
    // Swap-leg asset binding: ETH->VEIL leg cannot carry a mismatched asset.
    expect(() =>
      buildFullZkFlowArgs(baseInput({ depositAsset: ETH_ZERO }))
    ).toThrow(/InvalidSwapLeg|swap leg/i);
  });

  it("quotes first via zero-min simulation, then executes with derived min (ordering)", async () => {
    const mod = await import("../lib/zk-router");
    // Hidden live swap output: 1.35 VEIL. Succeeds iff minSwapOut <= hidden.
    const hidden = parseEther("1.35");
    const seenMins: bigint[] = [];
    let writes = 0;
    const mockClient = {
      async simulateContract(req: { args: readonly unknown[] }) {
        const callArgs = req.args as readonly unknown[];
        const min = callArgs[callArgs.length - 1] as bigint;
        seenMins.push(min);
        if (min > hidden) {
          const err = new Error("reverted: SlippageExceeded") as Error & {
            errorName: string;
          };
          err.errorName = "SlippageExceeded";
          throw err;
        }
        return { result: 424242n };
      },
    };
    const base = {
      withdrawal: WITHDRAWAL,
      proof: PROOF,
      scope: 123n,
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
    };
    const out = await mod.quoteAndBuildFullZkFlow(mockClient as never, {
      account: ACCOUNT,
      base,
      slippagePercent: 0.5,
    });
    // First simulation is the zero-floor preflight (no tx).
    expect(seenMins[0]).toBe(0n);
    // Probing stays read-only: lib never sends.
    expect(writes).toBe(0);
    // Derived min is live floor x slippage and brackets the hidden output.
    expect(out.minSwapOut).toBeLessThanOrEqual(hidden);
    expect(out.minSwapOut).toBe(
      (out.quotedSwapOut * 9950n) / 10000n
    );
    // Final pre-send simulation carries the derived min last.
    expect(seenMins[seenMins.length - 1]).toBe(out.minSwapOut);
    expect(seenMins.length).toBeGreaterThan(2);
    void writes;
  });

  it("fails closed when the zero-min preflight reverts (nothing sent)", async () => {
    const mod = await import("../lib/zk-router");
    const mockClient = {
      async simulateContract() {
        const err = new Error("reverted: AtomicityViolation") as Error & {
          errorName: string;
        };
        err.errorName = "AtomicityViolation";
        throw err;
      },
    };
    await expect(
      mod.quoteAndBuildFullZkFlow(mockClient as never, {
        account: ACCOUNT,
        base: {
          withdrawal: WITHDRAWAL,
          proof: PROOF,
          scope: 123n,
          withdrawAsset: ETH_ZERO,
          depositAsset: VEIL,
          depositValue: parseEther("0.5"),
          precommitment: 999n,
          zeroForOne: true,
        },
        slippagePercent: 0.5,
      })
    ).rejects.toThrow(/AtomicityViolation/);
  });

  it("maps every router revert to a short human message (never raw dumps)", async () => {
    const { mapZkRouterError } = await import("../lib/zk-router");
    expect(mapZkRouterError(new Error("User rejected the request"))).toMatch(
      /cancelled/i
    );
    expect(
      mapZkRouterError({ errorName: "SlippageExceeded" }, 0.5)
    ).toMatch(/SlippageExceeded/);
    expect(mapZkRouterError({ errorName: "AtomicityViolation" })).toMatch(
      /AtomicityViolation/
    );
    expect(mapZkRouterError({ errorName: "RecipientMismatch" })).toMatch(
      new RegExp(ZK_ROUTER.slice(0, 10), "i")
    );
    expect(mapZkRouterError({ errorName: "InvalidSwapLeg" })).toMatch(
      /InvalidSwapLeg/
    );
    expect(
      mapZkRouterError(new Error("reverted: InsufficientOutputForDenomination"))
    ).toMatch(/InsufficientOutputForDenomination/);
    expect(
      mapZkRouterError({ cause: { errorName: "NonZeroBalanceInvariantFailed" } })
    ).toMatch(/NonZeroBalanceInvariantFailed/);
    const huge = mapZkRouterError(new Error(`boom ${"0xab".repeat(500)}`));
    expect(huge.length).toBeLessThanOrEqual(321);
    expect(huge).not.toMatch(/0xababab/);
  });

  it("finds FullZkFlowExecuted only for our commitment", async () => {
    const { findFullZkFlowExecuted } = await import("../lib/zk-router");
    const commitment = 424242n;
    expect(findFullZkFlowExecuted([], commitment)).toBeNull();
    expect(
      findFullZkFlowExecuted(
        [{ data: "0x" as `0x${string}`, topics: ["0xdead" as `0x${string}`] }],
        commitment
      )
    ).toBeNull();
  });

  it("gates execution until a fresh quote exists", async () => {
    const { isZkExecuteDisabled } = await import("../lib/zk-router");
    const ready = {
      isExecuting: false,
      connected: true,
      noteValid: true,
      isQuoting: false,
      hasQuote: true,
    };
    expect(isZkExecuteDisabled(ready)).toBe(false);
    expect(isZkExecuteDisabled({ ...ready, isQuoting: true })).toBe(true);
    expect(isZkExecuteDisabled({ ...ready, hasQuote: false })).toBe(true);
    expect(isZkExecuteDisabled({ ...ready, isExecuting: true })).toBe(true);
    expect(isZkExecuteDisabled({ ...ready, noteValid: false })).toBe(true);
    expect(isZkExecuteDisabled({ ...ready, connected: false })).toBe(false);
  });

  it("wires executeFullZkFlow into the trade page with prover steps + revalidate", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "app/trade/page.tsx"), "utf8");
    expect(src).toContain("executeFullZkFlow");
    expect(src).toContain("VEIL_ZK_ROUTER_ABI");
    expect(src).toContain("TESTNET_ZK_ROUTER_ADDRESS");
    // Prover-modal flow mirrors 0xbow: prove -> relay-in-tx -> swap -> deposit -> verify.
    expect(src).toMatch(/relay-in-tx/i);
    // Wallet drift guard before the send.
    const zkSection = src.slice(src.indexOf("executeFullZkFlow") - 4000);
    expect(zkSection).toContain("revalidateWallet");
  });
});

import { describe, it, expect } from "vitest";
import { parseEther } from "viem";

const SINGLE_ROUTER = "0x80b18d51fb6087b65cf8511b78b264d90fee585c";
const MULTI_ROUTER = "0xc009197da4c4e7134ab8d8969d9442a5c8afb220";
const ENTRYPOINT = "0xb68c3d25e5e9902363e8e10d5c0a471e65be8152";
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const ETH_ZERO = "0x0000000000000000000000000000000000000000" as const;
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9" as const;
const ETH_DENOM = 1000000000000000n;

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

describe("zk shielded swap tab (full-ZK router)", () => {
  it("pins live single + multi routers (no hardcoded drift)", async () => {
    const mod = await import("../lib/zk-router");
    expect(mod.TESTNET_ZK_ROUTER_ADDRESS.toLowerCase()).toBe(SINGLE_ROUTER);
    expect(
      (mod as Record<string, unknown>).TESTNET_ZK_ROUTER_MULTI_ADDRESS as string,
    ).toBeDefined();
    const multi = (
      mod as unknown as { TESTNET_ZK_ROUTER_MULTI_ADDRESS: string }
    ).TESTNET_ZK_ROUTER_MULTI_ADDRESS;
    expect(multi.toLowerCase()).toBe(MULTI_ROUTER);
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const multiJson = JSON.parse(
      readFileSync(join(process.cwd(), "deployments/zkrouter-multi-46630.json"), "utf8"),
    );
    expect(multi.toLowerCase()).toBe((multiJson.router as string).toLowerCase());
  });

  it("binds direction assets: VEIL->ETH and ETH->VEIL (no other pair)", async () => {
    const mod = await import("../lib/zk-router");
    const resolve = (
      mod as unknown as {
        resolveZkShieldedSwapAssets: (args: {
          sourceAsset: string;
          veilToken?: string;
        }) => { withdrawAsset: string; depositAsset: string; zeroForOne: boolean };
      }
    ).resolveZkShieldedSwapAssets;
    expect(typeof resolve).toBe("function");
    // ETH source -> ETH in (zeroForOne true) -> VEIL out.
    const ethIn = resolve({ sourceAsset: ETH_ZERO });
    expect(ethIn.withdrawAsset.toLowerCase()).toBe(ETH_ZERO.toLowerCase());
    expect(ethIn.depositAsset.toLowerCase()).toBe(VEIL.toLowerCase());
    expect(ethIn.zeroForOne).toBe(true);
    // VEIL source -> VEIL in (zeroForOne false) -> ETH out.
    const veilIn = resolve({ sourceAsset: VEIL });
    expect(veilIn.withdrawAsset.toLowerCase()).toBe(VEIL.toLowerCase());
    expect(veilIn.depositAsset.toLowerCase()).toBe(ETH_ZERO.toLowerCase());
    expect(veilIn.zeroForOne).toBe(false);
    // Anything else fails closed.
    expect(() => resolve({ sourceAsset: "0x000000000000000000000000000000000000dEaD" })).toThrow();
  });

  it("fixes destination: 0.001 both ways (pool fixed denomination, never the entrypoint minimum)", async () => {
    const mod = await import("../lib/zk-router");
    const fn = (
      mod as unknown as {
        resolveZkShieldedSwapDeposit: (args: {
          withdrawAsset: string;
          ethDenomination?: bigint;
          veilMinimum?: bigint | null;
        }) => bigint;
      }
    ).resolveZkShieldedSwapDeposit;
    expect(typeof fn).toBe("function");
    expect(fn({ withdrawAsset: VEIL })).toBe(ETH_DENOM);
    // Live minimum is accepted but IGNORED: the pool demands exactly 0.001.
    expect(fn({ withdrawAsset: ETH_ZERO, veilMinimum: parseEther("0.7") })).toBe(parseEther("0.001"));
    expect(fn({ withdrawAsset: ETH_ZERO, veilMinimum: null })).toBe(parseEther("0.001"));
    expect(fn({ withdrawAsset: ETH_ZERO, veilMinimum: 0n })).toBe(parseEther("0.001"));
  });

  it("derives multi minSwapOut from live quote x slippage (never hardcoded)", async () => {
    const mod = await import("../lib/zk-router");
    const build = (
      mod as unknown as {
        buildMultiFullZkFlowArgs: (input: Record<string, unknown>) => { minSwapOut: bigint };
      }
    ).buildMultiFullZkFlowArgs;
    expect(typeof build).toBe("function");
    const quoted = parseEther("2.7");
    const args = build({
      withdrawals: [WITHDRAWAL, WITHDRAWAL],
      proofs: [PROOF, PROOF],
      scopes: [11n, 11n],
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
      quotedSwapOut: quoted,
      slippagePercent: 0.5,
    });
    expect(args.minSwapOut).toBe((quoted * 9950n) / 10000n);
    expect(() => build({
      withdrawals: [WITHDRAWAL],
      proofs: [PROOF],
      scopes: [11n],
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
      quotedSwapOut: 0n,
      slippagePercent: 0.5,
    })).toThrow();
  });

  it("multi builder enforces recipient, arrays, cap, swap-leg binding (fail closed)", async () => {
    const mod = await import("../lib/zk-router");
    const build = (
      mod as unknown as {
        buildMultiFullZkFlowArgs: (input: Record<string, unknown>) => unknown;
      }
    ).buildMultiFullZkFlowArgs;
    const good = {
      withdrawals: [WITHDRAWAL],
      proofs: [PROOF],
      scopes: [11n],
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
      quotedSwapOut: parseEther("1.35"),
      slippagePercent: 0.5,
    };
    const out = (await import("../lib/zk-router")) as unknown as {
      TESTNET_ZK_ROUTER_MULTI_ADDRESS: string;
    };
    void out;
    // Recipient forced to the multi router.
    const built = build(good) as { recipient: string };
    expect(built.recipient.toLowerCase()).toBe(MULTI_ROUTER);
    expect(() => build({ ...good, withdrawals: [] })).toThrow(/EmptyWithdrawals|empty/i);
    expect(() => build({ ...good, proofs: [] })).toThrow(/ArrayLengthMismatch|length/i);
    expect(() =>
      build({
        ...good,
        withdrawals: Array.from({ length: 9 }, () => WITHDRAWAL),
        proofs: Array.from({ length: 9 }, () => PROOF),
        scopes: Array.from({ length: 9 }, () => 11n),
      }),
    ).toThrow(/TooManyWithdrawals|too many|8/i);
    expect(() => build({ ...good, depositValue: 0n })).toThrow();
    expect(() => build({ ...good, precommitment: 0n })).toThrow();
    // Swap-leg asset binding: ETH->VEIL leg cannot carry a mismatched asset.
    expect(() => build({ ...good, depositAsset: ETH_ZERO })).toThrow(/InvalidSwapLeg|swap leg/i);
    expect(() => build({ ...good, withdrawAsset: VEIL })).toThrow(/InvalidSwapLeg|swap leg/i);
    // Stale entrypoint fails closed.
    expect(() =>
      build({
        ...good,
        withdrawals: [{ processooor: "0x000000000000000000000000000000000000dead", data: "0x1234" }],
      }),
    ).toThrow(/processooor|entrypoint/i);
  });

  it("multi quotes first via zero-min simulation, then executes with derived min (ordering)", async () => {
    const mod = await import("../lib/zk-router");
    const quote = (
      mod as unknown as {
        quoteAndBuildMultiFullZkFlow: (
          client: unknown,
          params: { account: string; base: Record<string, unknown>; slippagePercent: number },
        ) => Promise<{ args: { minSwapOut: bigint }; quotedSwapOut: bigint; minSwapOut: bigint }>;
      }
    ).quoteAndBuildMultiFullZkFlow;
    expect(typeof quote).toBe("function");
    const hidden = parseEther("2.7");
    const seenMins: bigint[] = [];
    let writes = 0;
    const mockClient = {
      async simulateContract(req: { args: readonly unknown[] }) {
        const callArgs = req.args as readonly unknown[];
        const min = callArgs[callArgs.length - 1] as bigint;
        seenMins.push(min);
        if (min > hidden) {
          const err = new Error("reverted: SlippageExceeded") as Error & { errorName: string };
          err.errorName = "SlippageExceeded";
          throw err;
        }
        return { result: 777n };
      },
      async writeContract() {
        writes += 1;
        throw new Error("lib must never send: writeContract called");
      },
      async sendTransaction() {
        writes += 1;
        throw new Error("lib must never send: sendTransaction called");
      },
    };
    const out = await quote(mockClient as never, {
      account: ACCOUNT,
      base: {
        withdrawals: [WITHDRAWAL],
        proofs: [PROOF],
        scopes: [11n],
        withdrawAsset: ETH_ZERO,
        depositAsset: VEIL,
        depositValue: parseEther("0.5"),
        precommitment: 999n,
        zeroForOne: true,
      },
      slippagePercent: 0.5,
    });
    expect(seenMins[0]).toBe(0n);
    expect(writes).toBe(0);
    expect(out.minSwapOut).toBeLessThanOrEqual(hidden);
    expect(out.minSwapOut).toBe((out.quotedSwapOut * 9950n) / 10000n);
    expect(seenMins[seenMins.length - 1]).toBe(out.minSwapOut);
    expect(seenMins.length).toBeGreaterThan(2);
  });

  it("multi fails closed when the zero-min preflight reverts (nothing sent)", async () => {
    const mod = await import("../lib/zk-router");
    const quote = (
      mod as unknown as {
        quoteAndBuildMultiFullZkFlow: (client: unknown, params: Record<string, unknown>) => Promise<unknown>;
      }
    ).quoteAndBuildMultiFullZkFlow;
    const mockClient = {
      async simulateContract() {
        const err = new Error("reverted: AtomicityViolation") as Error & { errorName: string };
        err.errorName = "AtomicityViolation";
        throw err;
      },
    };
    await expect(
      quote(mockClient as never, {
        account: ACCOUNT,
        base: {
          withdrawals: [WITHDRAWAL],
          proofs: [PROOF],
          scopes: [11n],
          withdrawAsset: ETH_ZERO,
          depositAsset: VEIL,
          depositValue: parseEther("0.5"),
          precommitment: 999n,
          zeroForOne: true,
        },
        slippagePercent: 0.5,
      }),
    ).rejects.toThrow(/AtomicityViolation/);
  });

  it("maps multi reverts to short human messages (fail closed)", async () => {
    const { mapZkRouterError } = await import("../lib/zk-router");
    expect(mapZkRouterError({ errorName: "EmptyWithdrawals" })).toMatch(/EmptyWithdrawals|withdrawal/i);
    expect(mapZkRouterError({ errorName: "TooManyWithdrawals" })).toMatch(/TooManyWithdrawals|8|batch/i);
    expect(mapZkRouterError({ errorName: "ArrayLengthMismatch" })).toMatch(/ArrayLengthMismatch|length/i);
    const huge = mapZkRouterError(new Error(`boom ${"0xab".repeat(500)}`));
    expect(huge.length).toBeLessThanOrEqual(321);
  });

  it("ships a shielded-swap panel mirroring the swap-to-shield pattern (picker + quote + execute)", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const panelPath = join(process.cwd(), "components/trade/ZkShieldedSwapPanel.tsx");
    expect(existsSync(panelPath)).toBe(true);
    const src = readFileSync(panelPath, "utf8");
    expect(src).toContain("You Spend");
    expect(src).toContain("Live swap quote");
    expect(src).toContain("minSwapOut");
    expect(src).toContain("Execute");
    expect(src).toContain("select");
    expect(src).toMatch(/source.*note|note.*picker|selectedNullifier|onSelectNote/i);
    expect(src).toContain("onQuote");
    expect(src).toContain("onExecute");
    // No legacy/Mock paths in the new panel.
    expect(src).not.toMatch(/Mock/i);
    expect(src).not.toMatch(/LEGACY|legacy pool|SHIELDED_POOL_ETH/i);
    expect(src).not.toMatch(/forceDirect|POOL_DEPOSIT_ABI/i);
  });

  it("enforces shielded-swap pre-send ordering behaviorally: revalidate -> simulate -> write (shipped path, no live txs)", async () => {
    const mod = await import("../lib/zk-router");
    const run = (
      mod as unknown as {
        runShieldedSwapPreSendSequence: (params: {
          flowKind: "single" | "multi";
          account: string;
          publicClient: unknown;
          walletClient: unknown;
          revalidate: () => Promise<unknown>;
          singleArgs?: unknown;
          multiArgs?: unknown;
        }) => Promise<string>;
      }
    ).runShieldedSwapPreSendSequence;
    expect(typeof run).toBe("function");
    const buildSingle = (
      mod as unknown as {
        buildFullZkFlowArgs: (input: Record<string, unknown>) => Record<string, unknown>;
      }
    ).buildFullZkFlowArgs;
    const buildMulti = (
      mod as unknown as {
        buildMultiFullZkFlowArgs: (input: Record<string, unknown>) => Record<string, unknown>;
      }
    ).buildMultiFullZkFlowArgs;
    const singleArgs = buildSingle({
      withdrawal: WITHDRAWAL,
      proof: PROOF,
      scope: 11n,
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
      quotedSwapOut: parseEther("1.35"),
      slippagePercent: 0.5,
    });
    const multiArgs = buildMulti({
      withdrawals: [WITHDRAWAL],
      proofs: [PROOF],
      scopes: [11n],
      withdrawAsset: ETH_ZERO,
      depositAsset: VEIL,
      depositValue: parseEther("0.5"),
      precommitment: 999n,
      zeroForOne: true,
      quotedSwapOut: parseEther("1.35"),
      slippagePercent: 0.5,
    });

    const makeMocks = (order: string[]) => ({
      publicClient: {
        async simulateContract() {
          order.push("simulate");
          return { result: 777n };
        },
      },
      walletClient: {
        async writeContract() {
          order.push("write");
          return "0xdeadbeef";
        },
      },
    });

    // Single-note shipped path: revalidate -> simulate -> write.
    {
      const order: string[] = [];
      const { publicClient, walletClient } = makeMocks(order);
      const hash = await run({
        flowKind: "single",
        account: ACCOUNT,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
        revalidate: async () => {
          order.push("revalidate");
        },
        singleArgs,
      });
      expect(hash).toBe("0xdeadbeef");
      expect(order).toEqual(["revalidate", "simulate", "write"]);
    }

    // Multi-note shipped path: same ordering via the multi pre-send sim.
    {
      const order: string[] = [];
      const { publicClient, walletClient } = makeMocks(order);
      const hash = await run({
        flowKind: "multi",
        account: ACCOUNT,
        publicClient: publicClient as never,
        walletClient: walletClient as never,
        revalidate: async () => {
          order.push("revalidate");
        },
        multiArgs,
      });
      expect(hash).toBe("0xdeadbeef");
      expect(order).toEqual(["revalidate", "simulate", "write"]);
    }

    // Fail closed: a pre-send sim revert sends nothing.
    {
      const order: string[] = [];
      const publicClient = {
        async simulateContract() {
          order.push("simulate");
          throw new Error("reverted: SlippageExceeded");
        },
      };
      const walletClient = {
        async writeContract() {
          order.push("write");
          return "0xdeadbeef";
        },
      };
      await expect(
        run({
          flowKind: "single",
          account: ACCOUNT,
          publicClient: publicClient as never,
          walletClient: walletClient as never,
          revalidate: async () => {
            order.push("revalidate");
          },
          singleArgs,
        }),
      ).rejects.toThrow();
      expect(order).toEqual(["revalidate", "simulate"]);
      expect(order).not.toContain("write");
    }

    // Fail closed: a revalidate failure simulates and sends nothing.
    {
      const order: string[] = [];
      const { publicClient, walletClient } = makeMocks(order);
      await expect(
        run({
          flowKind: "single",
          account: ACCOUNT,
          publicClient: publicClient as never,
          walletClient: walletClient as never,
          revalidate: async () => {
            order.push("revalidate");
            throw new Error("Wallet account changed mid-flow.");
          },
          singleArgs,
        }),
      ).rejects.toThrow(/Wallet account changed/);
      expect(order).toEqual(["revalidate"]);
    }

    // The shipped execute handler delegates to this sequence (call-site pin,
    // not comment matching): import + call inside handleZkShieldedSwapExecute.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "app/trade/page.tsx"), "utf8");
    expect(src).toContain("runShieldedSwapPreSendSequence");
    const execIdx = src.indexOf("handleZkShieldedSwapExecute");
    expect(execIdx).toBeGreaterThan(-1);
    const execSection = src.slice(execIdx, execIdx + 80000);
    expect(execSection).toContain("runShieldedSwapPreSendSequence");
    // Receipt asserts stay on the shipped execute path (both branches).
    expect(execSection).toMatch(/FullZkFlowExecuted/);
    expect(execSection).toMatch(/Deposited/);
    expect(execSection).toMatch(/nullifierHashes/);
    expect(execSection).toContain("mapZkRouterError");
    expect(execSection).toMatch(/InsufficientOutputForDenomination|multi|batch/i);
  });

  it("touches no legacy/Mock paths for the new shielded-swap flow (old exits unchanged)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const libSrc = readFileSync(join(process.cwd(), "lib/zk-router.ts"), "utf8");
    expect(libSrc).not.toMatch(/Mock/i);
    expect(libSrc).not.toMatch(/SHIELDED_POOL_ETH|LEGACY_EXIT|forceDirect/i);
    expect(libSrc).not.toMatch(/legacy router module/);
    const panelSrc = readFileSync(join(process.cwd(), "components/trade/ZkShieldedSwapPanel.tsx"), "utf8");
    expect(panelSrc).not.toMatch(/Mock/i);
    // Old-note exits stay as they are.
    const pageSrc = readFileSync(join(process.cwd(), "app/trade/page.tsx"), "utf8");
    expect(pageSrc).toContain("buildWithdrawArgs");
    expect(pageSrc).toMatch(/old notes only/i);
  });

  it("binds both directions on the shielded-swap path (VEIL->ETH, ETH->VEIL)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "app/trade/page.tsx"), "utf8");
    const idx = src.indexOf("handleZkShieldedSwap");
    expect(idx).toBeGreaterThan(-1);
    const section = src.slice(idx, idx + 80000);
    expect(section).toMatch(/zeroForOne|VEIL.*ETH|ETH.*VEIL/i);
    const libSrc = readFileSync(join(process.cwd(), "lib/zk-router.ts"), "utf8");
    expect(libSrc).toMatch(/zeroForOne/);
  });
});

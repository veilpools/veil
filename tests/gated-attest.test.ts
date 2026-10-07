import { describe, it, expect } from "vitest";
import {
  decodeAbiParameters,
  parseAbiParameters,
  parseEther,
  type PublicClient,
} from "viem";
import {
  buildFundedSimOverride,
  buildGatedHookInnerHash,
  buildGatedPoolId,
  buildGatedSwapCalldata,
  buildGatedSwapTxArgs,
  buildSelfAttestInnerHash,
  buildVeilAllowanceSlot,
  buildVeilBalanceSlot,
  decodeGatingRevert,
  describeGatedSimRevert,
  encodeGatedHookData,
  GATED_HOOK_ADDRESS,
  GATED_POOL_ID,
  GATED_POOL_KEY,
  GATED_REGISTRY_ADDRESS,
  GATED_SWAPPER_ADDRESS,
  GATED_VEIL_TOKEN,
  isGatedExecuteDisabled,
  isGatingActive,
  isUserRejection,
  mapGatedSwapError,
  mapSelfAttestError,
  readAttestationStatus,
  readGatingConfig,
  simulateGatedSwapCall,
} from "../lib/gated-attest";
import gatedSimFixture from "./fixtures/gated-simulation.json";

const USER = "0x1111111111111111111111111111111111111111" as const;
const ROOT =
  "0x2222222222222222222222222222222222222222222222222222222222222222" as const;

describe("gated attest builders (testnet e2e task 3)", () => {
  it("pins the reconciled v2 registry/hook/pool addresses verbatim", () => {
    // Reconciled 2026-10-07: v2 suite from scripts/selfattest-hook-v2.mjs
    // (hook.registry() == registry onchain, operator attested, pool gated).
    // lib/contracts.ts TESTNET_* still points at the older suite.
    expect(GATED_REGISTRY_ADDRESS).toBe(
      "0x0a9bc900d7831d9e2589fb44f6b0754d3f572f36"
    );
    expect(GATED_HOOK_ADDRESS).toBe(
      "0xbebfc3048c7ced099337abe46e56189fa63420c4"
    );
    expect(GATED_SWAPPER_ADDRESS).toBe(
      "0x14c27b66fba1b561a920bd03970ae20c53608dff"
    );
    expect(GATED_VEIL_TOKEN).toBe(
      "0x019086f63407fadf0ccb89516e465baef5031aa9"
    );
    expect(GATED_POOL_KEY.currency0).toBe(
      "0x0000000000000000000000000000000000000000"
    );
    expect(GATED_POOL_KEY.currency1).toBe(GATED_VEIL_TOKEN);
    expect(GATED_POOL_KEY.fee).toBe(3000);
    expect(GATED_POOL_KEY.tickSpacing).toBe(60);
    expect(GATED_POOL_KEY.hooks).toBe(GATED_HOOK_ADDRESS);
  });

  it("derives the onchain gated poolId from the proven poolKey", () => {
    expect(buildGatedPoolId()).toBe(GATED_POOL_ID);
    expect(GATED_POOL_ID).toBe(
      "0x837b0a31b5577f02f98e51829cab48f6e5b190546e168772523dd1c5c409419c"
    );
  });

  it("builds the selfAttest EIP-191 hash exactly like the proven script", () => {
    const inner = buildSelfAttestInnerHash({
      registry: GATED_REGISTRY_ADDRESS,
      chainId: 46630n,
      user: USER,
      proofRoot: ROOT,
      nonce: 0n,
      deadline: 2000000000n,
    });
    expect(inner).toBe(
      "0xd023b9407b02aa7b02256b5800dad85436585bbc6892259728a2d1e333a9909b"
    );
    // Nonce binds the message: bumping it changes the hash (replay safety).
    const bumped = buildSelfAttestInnerHash({
      registry: GATED_REGISTRY_ADDRESS,
      chainId: 46630n,
      user: USER,
      proofRoot: ROOT,
      nonce: 1n,
      deadline: 2000000000n,
    });
    expect(bumped).not.toBe(inner);
  });

  it("builds the signature-bound hookData hash exactly like the script", () => {
    const inner = buildGatedHookInnerHash({
      hook: GATED_HOOK_ADDRESS,
      chainId: 46630n,
      user: USER,
      poolId: GATED_POOL_ID,
      deadline: 2000000600n,
    });
    expect(inner).toBe(
      "0xd03ba432d3725e2b0f36e3ee0f69105b7adebc7925c6c0adfe2490dfc36a13e4"
    );
  });

  it("encodes hookData as (user, deadline, signature) and round-trips", () => {
    const sig =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef00" as `0x${string}`;
    const encoded = encodeGatedHookData({
      user: USER,
      deadline: 2000000600n,
      signature: sig,
    });
    expect(encoded).toBe(
      "0x0000000000000000000000001111111111111111111111111111111111111111000000000000000000000000000000000000000000000000000000007735965800000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000041deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef0000000000000000000000000000000000000000000000000000000000000000"
    );
    const [user, deadline, signature] = decodeAbiParameters(
      parseAbiParameters("address user, uint256 deadline, bytes signature"),
      encoded
    );
    expect(user.toLowerCase()).toBe(USER.toLowerCase());
    expect(deadline).toBe(2000000600n);
    expect(signature.toLowerCase()).toBe(sig.toLowerCase());
  });

  it("builds swapExactIn calldata for the proven VEIL-in route", () => {
    const hookData = encodeGatedHookData({
      user: USER,
      deadline: 2000000600n,
      signature: "0x1234" as `0x${string}`,
    });
    const data = buildGatedSwapCalldata({
      from: USER,
      amountIn: parseEther("0.5"),
      hookData,
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(600);
    expect(() =>
      buildGatedSwapCalldata({ from: USER, amountIn: 0n, hookData })
    ).toThrow(/greater than zero/);
    const txArgs = buildGatedSwapTxArgs({
      from: USER,
      amountIn: parseEther("0.5"),
      hookData,
    });
    expect(txArgs[0].zeroForOne).toBe(false);
    expect(txArgs[0].amountIn).toBe(parseEther("0.5"));
    expect(txArgs[0].minOut).toBe(1n);
    expect(txArgs[0].inputToken.toLowerCase()).toBe(
      GATED_VEIL_TOKEN.toLowerCase()
    );
    expect(txArgs[0].key.hooks).toBe(GATED_HOOK_ADDRESS);
  });

  it("computes classic-OZ virtual funding slots for gas-free simulation", () => {
    // Layout verified onchain 2026-10-07: _balances@0 matches balanceOf and
    // _allowances@1 matches allowance via eth_getStorageAt.
    expect(buildVeilBalanceSlot(USER)).toBe(
      "0xf043c50fe795c69f30b8ff78b84032dc53a9d87ca283ae10a1dacfbb648e83ef"
    );
    expect(buildVeilAllowanceSlot(USER, GATED_SWAPPER_ADDRESS)).toBe(
      "0x5cba8897f3c834b624fc5e775b01249b2daa8df3a1c236c647c40b814f548142"
    );
    const amount = parseEther("0.5");
    const override = buildFundedSimOverride(USER, amount);
    const diff = override[GATED_VEIL_TOKEN].stateDiff;
    expect(Object.keys(diff)).toHaveLength(2);
    expect(diff[buildVeilBalanceSlot(USER)]).toBe(
      `0x${amount.toString(16).padStart(64, "0")}`
    );
    expect(diff[buildVeilAllowanceSlot(USER, GATED_SWAPPER_ADDRESS)]).toBe(
      `0x${amount.toString(16).padStart(64, "0")}`
    );
  });
});

describe("attestation + gating readers (mocked client)", () => {
  function mockReader(responses: Record<string, unknown>): PublicClient {
    return {
      readContract: async (args: {
        functionName: string;
        args?: readonly unknown[];
      }) => {
        const key = `${args.functionName}:${JSON.stringify(args.args)}`;
        if (!(key in responses)) throw new Error(`unexpected call ${key}`);
        return responses[key];
      },
    } as unknown as PublicClient;
  }

  it("parses live attestation status per address (never localStorage)", async () => {
    const attested = mockReader({
      'verifyAttestation:["0x1111111111111111111111111111111111111111"]': true,
      'attestationNonce:["0x1111111111111111111111111111111111111111"]': 3n,
    });
    const status = await readAttestationStatus(attested, USER);
    expect(status).toEqual({ attested: true, nonce: 3n });

    const fresh = mockReader({
      'verifyAttestation:["0x1111111111111111111111111111111111111111"]': false,
      'attestationNonce:["0x1111111111111111111111111111111111111111"]': 0n,
    });
    expect(await readAttestationStatus(fresh, USER)).toEqual({
      attested: false,
      nonce: 0n,
    });
  });

  it("reads gating config live and derives window activity honestly", async () => {
    const now = 1792430000n;
    const reader = mockReader({
      [`isPoolGated:["${GATED_POOL_ID}"]`]: true,
      [`poolGatingDuration:["${GATED_POOL_ID}"]`]: 2592000n,
      [`poolLaunchTime:["${GATED_POOL_ID}"]`]: now - 100n,
    });
    const withBlock = {
      ...reader,
      getBlock: async () => ({ timestamp: now }),
    } as unknown as PublicClient;
    const config = await readGatingConfig(withBlock);
    expect(config.gated).toBe(true);
    expect(config.active).toBe(true);
    expect(config.windowEndsAt).toBe(now - 100n + 2592000n);
  });

  it("marks expired windows and ungated pools inactive", () => {
    expect(
      isGatingActive({ gated: true, duration: 600n, launchTime: 1000n, nowSeconds: 2000n })
    ).toBe(false);
    expect(
      isGatingActive({ gated: false, duration: 600n, launchTime: 1000n, nowSeconds: 1001n })
    ).toBe(false);
    expect(
      isGatingActive({ gated: true, duration: 0n, launchTime: 1000n, nowSeconds: 999999999n })
    ).toBe(true);
    expect(
      isGatingActive({ gated: true, duration: 600n, launchTime: 1000n, nowSeconds: 1599n })
    ).toBe(true);
  });
});

describe("gas-free simulation decoding (R4)", () => {
  it("decodes the honest GatingActiveUserNotAttested rejection", () => {
    expect(decodeGatingRevert({ cause: { data: "0xbc7aea4f" } })).toBe(
      "GatingActiveUserNotAttested"
    );
    expect(decodeGatingRevert({ cause: { data: "0x203d82d8" } })).toBe("Expired");
    expect(decodeGatingRevert({ cause: { data: "0x8baa579f" } })).toBe(
      "InvalidSignature"
    );
    // Live 2026-10-07 WrappedError blob: the PoolManager wraps the hook
    // revert, so GatingActive sits nested (0x90bfb865…bc7aea4f…).
    expect(
      decodeGatingRevert({
        cause: {
          data: "0x90bfb865000000000000000000000000bebfc3048c7ced099337abe46e56189fa63420c40000000000000000000000000000000000000000000000000000000000000004bc7aea4f00000000000000000000000000000000000000000000000000000000",
        },
      })
    ).toBe("GatingActiveUserNotAttested");
    expect(decodeGatingRevert(new Error("boom"))).toBe("Unknown");
    expect(
      describeGatedSimRevert("GatingActiveUserNotAttested")
    ).toMatch(/GatingActiveUserNotAttested/);
  });

  it("decodes multi-selector blobs by innermost (most specific) match", () => {
    // M-4: a blob containing two gating selectors must not always report
    // GatingActiveUserNotAttested. The innermost (last-appearing) selector
    // wins, matching the deepest revert in nested WrappedError data.
    const gatingThenExpired =
      "0xbc7aea4f00000000000000000000000000000000000000000000000000000000203d82d8" as const;
    expect(decodeGatingRevert({ cause: { data: gatingThenExpired } })).toBe(
      "Expired"
    );
    const expiredThenGating =
      "0x203d82d800000000000000000000000000000000000000000000000000000000bc7aea4f" as const;
    expect(decodeGatingRevert({ cause: { data: expiredThenGating } })).toBe(
      "GatingActiveUserNotAttested"
    );
    const gatingThenInvalidSig =
      "0xbc7aea4f000000000000000000000000000000000000000000000000000000008baa579f" as const;
    expect(
      decodeGatingRevert({ cause: { data: gatingThenInvalidSig } })
    ).toBe("InvalidSignature");
  });

  it("simulateGatedSwapCall sends the funding override and surfaces rejection", async () => {
    const hookData = encodeGatedHookData({
      user: USER,
      deadline: 2000000600n,
      signature: "0x1234" as `0x${string}`,
    });
    const seen: unknown[][] = [];
    const failing = {
      request: async (args: { method: string; params: unknown[] }) => {
        seen.push(args.params);
        throw { cause: { data: "0x90bfb865bc7aea4f" } };
      },
    } as unknown as PublicClient;
    const rejected = await simulateGatedSwapCall(failing, {
      from: USER,
      amountIn: parseEther("0.5"),
      hookData,
    });
    // Override travels with the eth_call: virtual VEIL fund + approval.
    expect(seen).toHaveLength(1);
    expect(seen[0][1]).toBe("latest");
    const override = seen[0][2] as Record<string, { stateDiff: Record<string, string> }>;
    expect(Object.keys(override[GATED_VEIL_TOKEN].stateDiff)).toHaveLength(2);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.reason).toBe("GatingActiveUserNotAttested");
      expect(rejected.message).toMatch(/no gas was spent/i);
    }
    const passed = await simulateGatedSwapCall(
      { request: async () => "0x" } as unknown as PublicClient,
      { from: USER, amountIn: parseEther("0.5"), hookData }
    );
    expect(passed).toEqual({ ok: true, returnData: "0x" });
  });
});

describe("gated error mapping + execute gating", () => {
  it("maps attest/swap failures to honest English", () => {
    expect(mapSelfAttestError(new Error("User rejected the request"))).toMatch(
      /cancelled/i
    );
    expect(mapSelfAttestError({ cause: { data: "0x203d82d8" } })).toMatch(
      /Expired/
    );
    expect(mapGatedSwapError({ cause: { data: "0xbc7aea4f" } })).toMatch(
      /GatingActiveUserNotAttested/
    );
    expect(mapGatedSwapError(new Error("ERC20InsufficientBalance"))).toMatch(
      /no onchain faucet/
    );
    expect(isUserRejection(new Error("User denied transaction"))).toBe(true);
  });

  it("keeps gated execution disabled until live attestation (fail closed)", () => {
    const ready = {
      isSwapping: false,
      connected: true,
      veilInValid: true,
      attested: true as boolean | null,
      isSimulating: false,
    };
    expect(isGatedExecuteDisabled(ready)).toBe(false);
    expect(isGatedExecuteDisabled({ ...ready, attested: false })).toBe(true);
    expect(isGatedExecuteDisabled({ ...ready, attested: null })).toBe(true);
    expect(isGatedExecuteDisabled({ ...ready, isSwapping: true })).toBe(true);
    expect(isGatedExecuteDisabled({ ...ready, veilInValid: false })).toBe(true);
    expect(isGatedExecuteDisabled({ ...ready, isSimulating: true })).toBe(true);
    expect(isGatedExecuteDisabled({ ...ready, connected: false })).toBe(false);
  });
});

describe("live simulation transcripts fixture (I-1, zero gas)", () => {
  it("pins the verbatim eth_call reject + pass legs from testnet", () => {
    // Fixture: tests/fixtures/gated-simulation.json (live 2026-10-07,
    // head 130555038, eth_call only). No private keys stored.
    expect(gatedSimFixture.chainId).toBe(46630);
    expect(gatedSimFixture.poolId).toBe(GATED_POOL_ID);
    expect(gatedSimFixture.poolKey.hooks).toBe(GATED_HOOK_ADDRESS);
    // REJECT leg: unattested fresh address reverts GatingActive nested in
    // WrappedError (0x90bfb865…bc7aea4f…).
    const rejectData = (
      gatedSimFixture.rejectLeg.response as { error: { data: string } }
    ).error.data.toLowerCase();
    expect(rejectData).toContain("90bfb865");
    expect(rejectData).toContain("bc7aea4f");
    expect(
      decodeGatingRevert({ cause: { data: (gatedSimFixture.rejectLeg.response as { error: { data: string } }).error.data } })
    ).toBe("GatingActiveUserNotAttested");
    expect(gatedSimFixture.rejectLeg.verifyAttestationRawBefore).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    // PASS leg: attested operator succeeds with amountOut bytes.
    expect(
      gatedSimFixture.passLeg.verifyAttestationRawBefore
    ).toBe("0x0000000000000000000000000000000000000000000000000000000000000001");
    const passResult = (gatedSimFixture.passLeg.response as { result: string })
      .result.toLowerCase();
    expect(passResult.startsWith("0x")).toBe(true);
    expect(passResult.length).toBeGreaterThan(10);
    // Both requests are eth_call with virtual-funding state override.
    for (const leg of [gatedSimFixture.rejectLeg, gatedSimFixture.passLeg]) {
      expect(leg.request.method).toBe("eth_call");
      expect(leg.request.params[1]).toBe("latest");
      const override = leg.request.params[2] as unknown as Record<
        string,
        { stateDiff: Record<string, string> }
      >;
      expect(
        Object.keys(override[GATED_VEIL_TOKEN].stateDiff)
      ).toHaveLength(2);
    }
  });
});

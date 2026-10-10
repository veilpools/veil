import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keccak256, encodeAbiParameters } from "viem";
import { VEIL_ZK_ROUTER_ABI } from "../lib/veil-artifact.mjs";

const source: string = readFileSync("contracts/VeilZkRouter.sol", "utf8");

type AbiEntry = {
  type: string;
  name?: string;
  inputs?: Array<{ name?: string; type?: string }>;
};

const abi = VEIL_ZK_ROUTER_ABI as unknown as AbiEntry[];

const fnNames = abi.filter((e) => e.type === "function").map((e) => e.name);
const errNames = abi.filter((e) => e.type === "error").map((e) => e.name);

describe("zk router context binding", () => {
  it("binds pool, minOut, commitment and fee into one context hash", () => {
    const ctx = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "uint256" }],
        ["0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6", 500000000000000000n, `0x${"11".repeat(32)}`, 0n]
      )
    );
    expect(ctx).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("zk router B1 atomicity binding", () => {
  it("drops the router-side proof re-check (no computeContext, no ContextHashMismatch)", () => {
    expect(fnNames).not.toContain("computeContext");
    expect(errNames).not.toContain("ContextHashMismatch");
    expect(source).not.toContain("computeContext");
    expect(source).not.toContain("ContextHashMismatch");
    expect(source).not.toContain("SNARK_SCALAR_FIELD");
  });

  it("withdrawal leg accepts no minOut param (minOut lives only on the post-swap leg)", () => {
    for (const fn of abi.filter((e) => e.type === "function")) {
      const inputNames = (fn.inputs ?? []).map((i) => (i.name ?? "").toLowerCase());
      // No withdrawal-leg input may be called minOut; the only minOut-style
      // param allowed is the post-swap guard on the atomic flow.
      for (const n of inputNames) {
        if (n === "minout") {
          expect(fn.name).toBe("executeFullZkFlow");
        }
      }
    }
    const exec = abi.find((e) => e.type === "function" && e.name === "executeFullZkFlow");
    expect(exec).toBeDefined();
    const relayOnly = abi.find((e) => e.type === "function" && e.name === "relay");
    expect(relayOnly).toBeUndefined();
  });

  it("enforces atomicity via a transient stage guard (partial flow reverts)", () => {
    expect(errNames).toContain("AtomicityViolation");
    expect(fnNames).toContain("executeFullZkFlow");
    expect(source).toContain("transient");
    expect(source).toContain("AtomicityViolation");
    expect(source).toContain("STAGE_IDLE");
  });

  it("delegates proof verification to the Entrypoint (documents atomicity, not validity)", () => {
    expect(source).toContain("verification delegated to Entrypoint");
    expect(source).toContain("router enforces atomicity, not proof validity");
    expect(source).toContain("fixed denomination");
  });

  it("keeps the swap-leg slippage wiring point without checking the withdrawal leg", () => {
    expect(errNames).toContain("SlippageExceeded");
    // Withdrawal-leg proof signals must not be re-checked router-side.
    expect(source).not.toContain("pubSignals[7]");
    expect(source).not.toContain("pubSignals[2]");
  });

  it("keeps recipient validation, poolManager wiring, nonReentrant and zero-checks with no Mock", () => {
    expect(source).toContain("nonReentrant");
    expect(source).toContain("poolManager");
    expect(source).toContain("ZeroAddress");
    expect(source).toContain("InvalidPrecommitment");
    expect(source).not.toContain("Mock");
  });
});

describe("zk router swap leg (relay -> swap -> deposit, atomic)", () => {
  it("routes the exact-input swap through PoolManager.unlock with a guarded callback", () => {
    expect(source).toContain("poolManager.unlock");
    expect(source).toContain("unlockCallback");
    expect(source).toContain("OnlyPoolManager");
    expect(source).toContain("poolManager.swap");
    expect(source).not.toContain("swap is pass-through");
  });

  it("performs an exact-input v4 swap with sqrtPriceLimit", () => {
    expect(source).toContain("SwapParams");
    expect(source).toContain("amountSpecified");
    expect(source).toContain("-int256");
    expect(source).toContain("sqrtPriceLimitX96");
    expect(source).toContain("zeroForOne");
  });

  it("enforces post-swap slippage (amountOut >= minSwapOut, not the withdrawal leg)", () => {
    expect(errNames).toContain("SlippageExceeded");
    // Live enforcement, not a wiring-point comment.
    expect(source).toMatch(/\n\s*if \(amountOut < minSwapOut\) revert SlippageExceeded\(\);/);
    expect(source).not.toContain("pubSignals[7]");
    expect(source).not.toContain("pubSignals[2]");
  });

  it("settles input natively via settle{value}, takes output, and refunds dust", () => {
    expect(source).toContain("_settleCurrency");
    expect(source).toContain("poolManager.take");
    expect(source).toContain("poolManager.settle");
    expect(source).toContain("amountOut > depositValue");
    expect(source).toContain("dust refund failed");
  });

  it("deposits swap output into the destination 0xbow pool via entrypoint", () => {
    expect(source).toContain("entrypoint.deposit");
    expect(source).toContain("forceApprove");
    expect(source).toContain("InsufficientOutputForDenomination");
  });

  it("keeps transient atomicity across relay, swap and deposit with invariant-0", () => {
    expect(source).toContain("STAGE_SWAPPING");
    expect(source).toContain("AtomicityViolation");
    expect(source).toContain("NonZeroBalanceInvariantFailed");
    expect(source).toContain("EthReceiveNotInFlow");
    expect(source).toContain("transient");
  });

  it("exposes the swap leg on executeFullZkFlow and emits swap-style events", () => {
    const exec = abi.find((e) => e.type === "function" && e.name === "executeFullZkFlow");
    expect(exec).toBeDefined();
    const inputBlob = JSON.stringify(exec?.inputs ?? []).toLowerCase();
    expect(inputBlob).toContain("swapleg");
    expect(inputBlob).toContain("sqrtpricelimit");
    const eventNames = abi.filter((e) => e.type === "event").map((e) => e.name);
    expect(eventNames).toContain("ZkSwapExecuted");
    expect(eventNames).toContain("FullZkFlowExecuted");
    const swapEvent = abi.find((e) => e.type === "event" && e.name === "ZkSwapExecuted");
    expect(JSON.stringify(swapEvent).toLowerCase()).toContain("amountout");
    expect(source).not.toContain("Mock");
  });
});

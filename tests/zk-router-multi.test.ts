import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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

describe("zk router multi-note full-flow (fixed-denom market fix)", () => {
  it("exposes executeMultiFullZkFlow and keeps executeFullZkFlow untouched", () => {
    expect(fnNames).toContain("executeMultiFullZkFlow");
    expect(fnNames).toContain("executeFullZkFlow");
    expect(source).toContain("function executeFullZkFlow(");
    expect(source).toContain("function executeMultiFullZkFlow(");
    // pragma + guardrails preserved
    expect(source).toContain("pragma solidity 0.8.37");
    expect(source).toContain("nonReentrant");
    expect(source).not.toContain("Mock");
  });

  it("takes withdrawal/proof/scope arrays plus single swapLeg, deposit target and minSwapOut", () => {
    const multi = abi.find((e) => e.type === "function" && e.name === "executeMultiFullZkFlow");
    expect(multi).toBeDefined();
    const blob = JSON.stringify(multi?.inputs ?? []).toLowerCase();
    expect(blob).toContain("withdrawals");
    expect(blob).toContain("proofs");
    expect(blob).toContain("scopes");
    // arrays (tuple[] / uint256[])
    expect(blob).toContain("tuple[]");
    expect(blob).toContain("uint256[]");
    // single swap leg + single deposit target + single slippage guard
    expect(blob).toContain("swapleg");
    expect(blob).toContain("depositasset");
    expect(blob).toContain("depositvalue");
    expect(blob).toContain("precommitment");
    expect(blob).toContain("minswapout");
    expect(blob).toContain("recipient");
    expect(blob).toContain("withdrawasset");
    // single swapLeg only (no array of legs)
    expect(blob).not.toContain("swaplegs");
  });

  it("rejects empty batches and mismatched array lengths", () => {
    expect(source).toContain("withdrawals.length");
    expect(source).toContain("proofs.length");
    expect(source).toContain("scopes.length");
    // equal-length + non-zero enforcement
    expect(source).toMatch(/proofs\.length !=|scopes\.length !=|ArrayLengthMismatch/);
    expect(source).toMatch(/== 0|EmptyWithdrawals|non-zero length|non-empty/);
  });

  it("caps batch length at 8 for gas sanity", () => {
    expect(source).toMatch(/\b8\b/);
    expect(source).toMatch(/MAX_MULTI|cap|TooManyWithdrawals|> 8|>\s*MAX/);
  });

  it("keeps minSwapOut-only-on-swap (no withdrawal-leg minOut)", () => {
    for (const fn of abi.filter((e) => e.type === "function")) {
      const inputNames = (fn.inputs ?? []).map((i) => (i.name ?? "").toLowerCase());
      for (const n of inputNames) {
        if (n === "minout") {
          expect(["executeFullZkFlow", "executeMultiFullZkFlow"]).toContain(fn.name);
        }
      }
    }
    expect(errNames).toContain("SlippageExceeded");
    expect(source).toMatch(/\n\s*if \(amountOut < minSwapOut\) revert SlippageExceeded\(\);/);
    expect(source).not.toContain("pubSignals[7]");
    expect(source).not.toContain("pubSignals[2]");
  });

  it("relays each proof via entrypoint, accumulates exact input, single swap + single fixed deposit", () => {
    expect(source).toContain("entrypoint.relay");
    expect(source).toContain("poolManager.unlock");
    expect(source).toContain("entrypoint.deposit");
    expect(source).toContain("forceApprove");
    // balance-delta accumulation + zero-total rejection
    expect(source).toContain("swapAmountIn");
    expect(source).toMatch(/swapAmountIn == 0/);
    // single deposit carved from swap output + dust refund
    expect(source).toContain("amountOut < depositValue");
    expect(source).toContain("amountOut > depositValue");
    expect(source).toContain("dust refund failed");
    // revalidate-style zero checks
    expect(source).toContain("RecipientMismatch");
    expect(source).toContain("InvalidPrecommitment");
    expect(source).toContain("ZeroAddress");
    expect(source).toContain("InvalidSwapLeg");
  });

  it("keeps transient atomicity across ALL legs with invariant-0 and per-leg + full events", () => {
    expect(errNames).toContain("AtomicityViolation");
    expect(source).toContain("transient");
    expect(source).toContain("STAGE_IDLE");
    expect(source).toContain("STAGE_RELAYING");
    expect(source).toContain("STAGE_SWAPPING");
    expect(source).toContain("STAGE_DEPOSITING");
    expect(source).toContain("NonZeroBalanceInvariantFailed");
    expect(source).toContain("EthReceiveNotInFlow");
    const eventNames = abi.filter((e) => e.type === "event").map((e) => e.name);
    expect(eventNames).toContain("ZkRelayExecuted");
    expect(eventNames).toContain("ZkSwapExecuted");
    expect(eventNames).toContain("ZkDepositExecuted");
    expect(eventNames).toContain("FullZkFlowExecuted");
    // per-leg relay emits + one full-flow emit in multi path
    const multiSection = source.slice(source.indexOf("function executeMultiFullZkFlow("));
    expect(multiSection).toContain("ZkRelayExecuted");
    expect(multiSection).toContain("ZkSwapExecuted");
    expect(multiSection).toContain("FullZkFlowExecuted");
  });

  it("documents B1 delegation (atomicity, not proof validity) with no novel crypto", () => {
    expect(source).toContain("verification delegated to Entrypoint");
    expect(source).toContain("router enforces atomicity, not proof validity");
    expect(source).toContain("fixed denomination");
    expect(source).not.toContain("computeContext");
    expect(source).not.toContain("ContextHashMismatch");
    expect(source).not.toContain("SNARK_SCALAR_FIELD");
    expect(source).not.toContain("Mock");
  });
});

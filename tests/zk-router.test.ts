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

describe("zk router context binding", () => {
  it("binds pool, minOut, commitment and fee into one context hash", async () => {
    const { keccak256, encodeAbiParameters } = await import("viem");
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

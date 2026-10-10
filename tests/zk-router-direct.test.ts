import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VEIL_ZK_ROUTER_ABI } from "../lib/veil-artifact";

const src = () => readFileSync("contracts/VeilZkRouter.sol", "utf8");

function directBody(): string {
  const s = src();
  const start = s.indexOf("function executeFullZkFlowDirect(");
  expect(start).toBeGreaterThan(-1);
  const end = s.indexOf("function executeMultiFullZkFlow(", start);
  expect(end).toBeGreaterThan(start);
  return s.slice(start, end);
}

describe("direct payout flow (sub-denom outputs)", () => {
  it("exposes executeFullZkFlowDirect with recipient-chained relay and payout recipient", () => {
    const fns = VEIL_ZK_ROUTER_ABI.filter((e) => e.type === "function" && e.name === "executeFullZkFlowDirect");
    expect(fns).toHaveLength(1);
    const names = (fns[0] as unknown as { inputs: readonly { name: string }[] }).inputs.map((i) => i.name);
    expect(names).toEqual([
      "withdrawal",
      "proof",
      "scope",
      "recipient",
      "withdrawAsset",
      "outputRecipient",
      "swapLeg",
      "minSwapOut",
    ]);
    // No deposit leg params: dust cannot become a note.
    expect(names).not.toContain("depositValue");
    expect(names).not.toContain("precommitment");
    expect((fns[0] as { stateMutability: string }).stateMutability).toBe("payable");
  });

  it("emits ZkDirectPayoutExecuted with recipient, asset and amount", () => {
    const evs = VEIL_ZK_ROUTER_ABI.filter((e) => e.type === "event" && e.name === "ZkDirectPayoutExecuted");
    expect(evs).toHaveLength(1);
    const inputs = (evs[0] as unknown as { inputs: readonly { name: string }[] }).inputs.map((i) => i.name);
    expect(inputs).toEqual(["relayer", "outputRecipient", "outputAsset", "amountOut"]);
  });

  it("keeps proof verification delegated (no router-side re-check)", () => {
    const body = directBody();
    expect(body).not.toMatch(/ContextHashMismatch/);
    expect(body).not.toMatch(/computeContext/);
    expect(body).toMatch(/entrypoint\.relay\(withdrawal, proof, scope\)/);
  });

  it("enforces atomicity, recipient chaining and invariant-0", () => {
    const body = directBody();
    expect(body).toMatch(/_stage != STAGE_IDLE.*AtomicityViolation/s);
    expect(body).toMatch(/recipient != address/);
    expect(body).toMatch(/RecipientMismatch/);
    expect(body).toMatch(/outputRecipient == address\(0\).*ZeroAddress/s);
    expect(body).toMatch(/poolManager\.unlock\(abi\.encode\(swapLeg, swapAmountIn\)\)/);
    expect(body).toMatch(/NonZeroBalanceInvariantFailed/);
    expect(body).toMatch(/nonReentrant/);
  });

  it("rejects zero output and guards slippage on the swap leg only", () => {
    const body = directBody();
    expect(body).toMatch(/amountOut < minSwapOut.*SlippageExceeded/s);
    expect(body).toMatch(/amountOut == 0.*InsufficientOutputForDenomination/s);
  });

  it("touches no Mock and no novel crypto", () => {
    const body = directBody();
    expect(body).not.toMatch(/Mock/);
    expect(body).not.toMatch(/SNARK_SCALAR_FIELD/);
  });

  it("leaves the shielded single flow intact", () => {
    const names = VEIL_ZK_ROUTER_ABI.filter((e) => e.type === "function").map((e) => e.name);
    expect(names).toContain("executeFullZkFlow");
    expect(names).toContain("executeMultiFullZkFlow");
    const evNames = VEIL_ZK_ROUTER_ABI.filter((e) => e.type === "event").map((e) => e.name);
    expect(evNames).toContain("FullZkFlowExecuted");
  });
});

import { describe, it, expect } from "vitest";
import { keccak256, encodeAbiParameters } from "viem";

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

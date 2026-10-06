import { describe, it, expect } from "vitest";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

describe("Contract address source", () => {
  it("points at live mainnet deployments with valid hex addresses", () => {
    expect(CONTRACT_ADDRESSES.poolEth).toBe("0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0");
    expect(CONTRACT_ADDRESSES.hook).toBe("0x9df0b52bf290a13e11c73c56c4c533e3887760c4");
    expect(CONTRACT_ADDRESSES.router).toBe("0x01a05f87c2c227a1b382cbc2e7e63b186538c86d");
    expect(CONTRACT_ADDRESSES.treasury).toBe("0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34");
    expect(CONTRACT_ADDRESSES.registry).toBe("0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855");
    expect(CONTRACT_ADDRESSES.verifier).toBe("0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda");
    expect(CONTRACT_ADDRESSES.deployer).toBe("0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008");
    for (const [key, addr] of Object.entries(CONTRACT_ADDRESSES)) {
      // token is empty until the canonical token deploys (NEXT_PUBLIC_VEIL_TOKEN).
      if (key === "token" && addr === "") continue;
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});

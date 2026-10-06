import { describe, it, expect } from "vitest";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

describe("Contract address source", () => {
  it("points at live mainnet deployments with valid hex addresses", () => {
    expect(CONTRACT_ADDRESSES.poolEth).toBe("0x3c4700360e23aa2d4671605f35e0fa1d354bc41b");
    expect(CONTRACT_ADDRESSES.hook).toBe("0x5b2e52fe4f54327d8272327d12e47cba834360c4");
    expect(CONTRACT_ADDRESSES.router).toBe("0xdce5cf65038f092c283449fda44e23d8820d717f");
    expect(CONTRACT_ADDRESSES.treasury).toBe("0x1b631ab61b99b364e3a880bd43adfe1b665bce16");
    expect(CONTRACT_ADDRESSES.registry).toBe("0x411fb0c695152ea02ef48b96940c2b2fef656b7c");
    expect(CONTRACT_ADDRESSES.verifier).toBe("0x12b20b346342d2fc5272f0f708bcd5abaac480fb");
    expect(CONTRACT_ADDRESSES.deployer).toBe("0x3d1613651c366ce53fd64bada154d1b951b9233f");
    for (const addr of Object.values(CONTRACT_ADDRESSES)) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});

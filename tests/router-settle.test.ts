import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  VEIL_SHIELD_ROUTER_ABI,
  VEIL_SHIELD_ROUTER_BYTECODE,
} from "../lib/veil-artifact";

// Task R1: regression guards for the router ETH-settlement fix.
// Root cause: `_settleCurrency` sent native ETH to the PoolManager with a
// bare `.call{value}()`, but the canonical v4 PoolManager has no
// receive()/fallback() -- native settlement only works via the payable
// `settle{value}()` entrypoint (paid = msg.value). The bare call always
// reverted, surfacing as `eth settle failed` on every ETH-input path.
const ROUTER_SOURCE = readFileSync(
  new URL("../contracts/VeilShieldRouter.sol", import.meta.url),
  "utf8"
);

// sha256 of the PRE-fix VEIL_SHIELD_ROUTER_BYTECODE (artifact at BASE
// f0de441, solc 0.8.37). The fix must change the compiled bytecode.
const PRE_FIX_BYTECODE_SHA256 =
  "0fa5c5e226f5af85f501f70196eb8b202018469345f403f59ee531a37a8a6ba0";

describe("Router ETH settlement (R1 fix)", () => {
  it("settles native ETH via PoolManager.settle{value}(), not a bare call", () => {
    expect(ROUTER_SOURCE).toContain("poolManager.settle{value: amount}()");
    expect(ROUTER_SOURCE).not.toContain(
      "address(poolManager).call{value: amount}"
    );
  });

  it("asserts the settled amount equals the requested amount", () => {
    expect(ROUTER_SOURCE).toContain("require(paid == amount");
  });

  it("keeps the ERC20 branch byte-identical in behavior", () => {
    expect(ROUTER_SOURCE).toContain(
      "IERC20(assetAddr).safeTransfer(address(poolManager), amount)"
    );
    expect(ROUTER_SOURCE).toContain("poolManager.settle();");
  });

  it("exposes the same external function surface (ABI stability)", () => {
    const fns = VEIL_SHIELD_ROUTER_ABI.filter((e) => e.type === "function").map(
      (e) => e.name
    );
    expect([...fns].sort()).toEqual(
      ["poolManager", "shieldedSwap", "swapToShield", "unlockCallback"].sort()
    );
    expect(fns).not.toContain("_settleCurrency");
  });

  it("ships changed router bytecode (fix is compiled in)", () => {
    expect(VEIL_SHIELD_ROUTER_BYTECODE.startsWith("0x")).toBe(true);
    expect(VEIL_SHIELD_ROUTER_BYTECODE.length).toBeGreaterThan(1000);
    const digest = createHash("sha256")
      .update(VEIL_SHIELD_ROUTER_BYTECODE)
      .digest("hex");
    expect(digest).not.toBe(PRE_FIX_BYTECODE_SHA256);
  });
});

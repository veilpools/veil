import { describe, expect, it } from "vitest";
import { EVM_WALLETS, isEvmAddress, matchEvm, walletLabel } from "../lib/wallets";

describe("veil wallets registry", () => {
  it("lists six EVM wallets with logos and install URLs", () => {
    expect(EVM_WALLETS.map((w) => w.id)).toEqual(["metamask", "rabby", "coinbase", "okx", "trust", "phantom"]);
    for (const w of EVM_WALLETS) {
      expect(w.installUrl).toMatch(/^https:\/\//);
      expect(w.icon).toMatch(/^\/wallets\//);
    }
  });

  it("strictly distinguishes MetaMask from spoofing providers", () => {
    expect(matchEvm({ isMetaMask: true }, "metamask")).toBe(true);
    expect(matchEvm({ isMetaMask: true, isRabby: true }, "metamask")).toBe(false);
    expect(matchEvm({ isMetaMask: true, isRabby: true }, "rabby")).toBe(true);
    expect(matchEvm({ isPhantom: true }, "phantom")).toBe(true);
    expect(matchEvm({ isCoinbaseWallet: true }, "coinbase")).toBe(true);
    expect(matchEvm({ isOkxWallet: true }, "okx")).toBe(true);
    expect(matchEvm({ isTrustWallet: true }, "trust")).toBe(true);
  });

  it("validates checksummed and lowercase EVM addresses", () => {
    expect(isEvmAddress("0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d")).toBe(true);
    expect(isEvmAddress("0x3c4700360e23aa2d4671605f35e0fa1d354bc41b")).toBe(true);
    expect(isEvmAddress("invalid-addr")).toBe(false);
    expect(isEvmAddress("0x123")).toBe(false);
  });

  it("formats user-friendly error messages", () => {
    expect(walletLabel(new Error("wallet_missing"))).toContain("not detected");
    expect(walletLabel(new Error("wallet_rejected"))).toContain("cancelled");
    expect(walletLabel(new Error("wallet_timeout"))).toContain("timed out");
  });
});

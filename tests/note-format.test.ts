import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import {
  ETH_ZERO_ADDRESS,
  formatNoteAmount,
  getNoteAssetSymbol,
} from "../lib/note-format";
import { TESTNET_VEIL_TOKEN } from "../lib/router-swap";

describe("note-format labels", () => {
  it("labels native ETH notes", () => {
    expect(formatNoteAmount(parseEther("0.001"))).toBe("0.001 ETH");
    expect(formatNoteAmount(parseEther("0.001"), ETH_ZERO_ADDRESS)).toBe("0.001 ETH");
    expect(getNoteAssetSymbol()).toBe("ETH");
    expect(getNoteAssetSymbol(ETH_ZERO_ADDRESS)).toBe("ETH");
  });

  it("labels pool VEIL notes as VEIL, never ETH (live incident 2026-10-08)", () => {
    expect(formatNoteAmount(parseEther("0.5"), TESTNET_VEIL_TOKEN)).toBe("0.5 VEIL");
    expect(getNoteAssetSymbol(TESTNET_VEIL_TOKEN)).toBe("VEIL");
    expect(getNoteAssetSymbol(TESTNET_VEIL_TOKEN.toUpperCase())).toBe("VEIL");
  });

  it("falls back to ETH for unknown assets", () => {
    expect(getNoteAssetSymbol("0x000000000000000000000000000000000000dEaD")).toBe("ETH");
  });
});

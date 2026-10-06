import { describe, it, expect } from "vitest";
import { createShieldedNote, serializeNote, deserializeNote } from "../lib/note";
import { parseEther } from "viem";

describe("Shielded Note Generator & Parser", () => {
  it("creates a well-formed shielded note with unique secrets", () => {
    const denom = parseEther("0.001");
    const note1 = createShieldedNote(denom);
    const note2 = createShieldedNote(denom);

    expect(note1.nullifier).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(note1.secret).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(note1.commitment).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(note1.nullifierHash).toMatch(/^0x[0-9a-fA-F]{64}$/);

    expect(note1.nullifier).not.toBe(note2.nullifier);
    expect(note1.secret).not.toBe(note2.secret);
    expect(note1.commitment).not.toBe(note2.commitment);
  });

  it("serializes and deserializes note accurately without data loss", () => {
    const denom = parseEther("0.001");
    const original = createShieldedNote(denom, "0x1111111111111111111111111111111111111111");
    const serialized = serializeNote(original);

    expect(serialized.startsWith("veil-note-v1:")).toBe(true);

    const recovered = deserializeNote(serialized);
    expect(recovered.asset).toBe(original.asset);
    expect(recovered.denomination).toBe(original.denomination);
    expect(recovered.nullifier).toBe(original.nullifier);
    expect(recovered.secret).toBe(original.secret);
    expect(recovered.nullifierHash).toBe(original.nullifierHash);
    expect(recovered.commitment).toBe(original.commitment);
  });

  it("throws error when deserializing invalid note", () => {
    expect(() => deserializeNote("invalid:format")).toThrow("Invalid Veil note format");
  });
});

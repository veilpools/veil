import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import { createShieldedNote } from "../lib/note";
import { buildWithdrawArgs, PROVISIONAL_PROOF } from "../lib/withdraw-args";

describe("Withdraw args builder", () => {
  it("binds nullifier hash and recipient with zero self-relay fee", () => {
    const note = createShieldedNote(parseEther("0.001"));
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    const recipient = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const args = buildWithdrawArgs(note, root, recipient);
    expect(args.proof).toBe(PROVISIONAL_PROOF);
    expect(args.root).toBe(root);
    expect(args.nullifierHash).toBe(note.nullifierHash);
    expect(args.recipient).toBe(recipient);
    expect(args.fee).toBe(0n);
  });

  it("rejects the zero address recipient", () => {
    const note = createShieldedNote(parseEther("0.001"));
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    expect(() =>
      buildWithdrawArgs(note, root, "0x0000000000000000000000000000000000000000" as `0x${string}`)
    ).toThrow("Recipient address is required");
  });
});

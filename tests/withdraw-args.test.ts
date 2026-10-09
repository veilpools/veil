import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseEther } from "viem";
import { createShieldedNote, createBowDepositSecrets, createBowNote } from "../lib/note";
import { buildWithdrawArgs, LEGACY_MOCK_PROOF } from "../lib/withdraw-args";

describe("Withdraw args builder", () => {
  it("binds nullifier hash and recipient with zero self-relay fee", () => {
    const note = createShieldedNote(parseEther("0.001"));
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    const recipient = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const args = buildWithdrawArgs(note, root, recipient);
    expect(args.proof).toBe(LEGACY_MOCK_PROOF);
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

  it("throws when handed a 0xbow note, which takes the Groth16 relay path", () => {
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const bow = createBowNote({
      scope,
      denomination: parseEther("0.001"),
      label: 77n,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0x1234",
      blockNumber: 130000000n,
    });
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    expect(() =>
      buildWithdrawArgs(bow, root, "0x1111111111111111111111111111111111111111" as `0x${string}`)
    ).toThrow("Groth16 relay path");
  });
});

describe("mock proof confined to old notes", () => {
  it("no new pathway references the legacy constant", () => {
    const src = readFileSync("lib/withdraw-args.ts", "utf8");
    expect(src).not.toContain("PROVISIONAL_PROOF");
    expect(src).toContain("LEGACY_MOCK_PROOF");
  });
});

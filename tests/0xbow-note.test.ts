import { describe, it, expect } from "vitest";
import {
  createBowDepositSecrets,
  createBowNote,
  serializeBowNote,
  deserializeBowNote,
  isBowNote,
  type BowShieldedNote,
} from "../lib/note";

describe("0xbow Note Cryptography & Storage", () => {
  it("derives valid nullifier, secret, and precommitment for 0xbow", () => {
    const scope = 129954000n;
    const secrets1 = createBowDepositSecrets(scope);
    const secrets2 = createBowDepositSecrets(scope);

    expect(secrets1.nullifier).toBeTypeOf("bigint");
    expect(secrets1.secret).toBeTypeOf("bigint");
    expect(secrets1.precommitment).toBeTypeOf("bigint");

    expect(secrets1.nullifier).not.toBe(secrets2.nullifier);
    expect(secrets1.secret).not.toBe(secrets2.secret);
    expect(secrets1.precommitment).not.toBe(secrets2.precommitment);
  });

  it("constructs a 0xbow note with Poseidon commitment hash", () => {
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const denomination = 1000000000000000n;
    const label = 42n;

    const note = createBowNote({
      scope,
      denomination,
      label,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: 130200000n,
      asset: "0x0000000000000000000000000000000000000000",
    });

    expect(isBowNote(note)).toBe(true);
    expect(note.type).toBe("0xbow");
    expect(note.version).toBe("v1.2.1");
    expect(note.label).toBe("42");
    expect(note.commitmentHash).toMatch(/^[0-9]+$/);
  });

  it("serializes and deserializes 0xbow note accurately", () => {
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const note = createBowNote({
      scope,
      denomination: 1000000000000000n,
      label: 101n,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0x1234",
      blockNumber: 130000000n,
    });

    const serialized = serializeBowNote(note);
    expect(serialized.startsWith("veil-bow-note-v1:")).toBe(true);

    const recovered = deserializeBowNote(serialized);
    expect(recovered.nullifier).toBe(note.nullifier);
    expect(recovered.secret).toBe(note.secret);
    expect(recovered.precommitment).toBe(note.precommitment);
    expect(recovered.label).toBe(note.label);
    expect(recovered.commitmentHash).toBe(note.commitmentHash);
    expect(recovered.scope).toBe(note.scope);
  });
});

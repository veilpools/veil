import { describe, it, expect } from "vitest";
import {
  createShieldedNote,
  createBowDepositSecrets,
  createBowNote,
  isBowNote,
  getWithdrawPath,
  serializeAnyNote,
  deserializeAnyNote,
  serializeNotesList,
  deserializeNotesList,
} from "../lib/note";
import {
  buildBowAssociationSet,
  BOW_ASP_SENTINEL_LABEL,
} from "../lib/0xbow-association";

describe("AnyShieldedNote serialize/deserialize roundtrip", () => {
  it("roundtrips a legacy keccak note through the Any envelope", () => {
    const original = createShieldedNote(1000000000000000n);
    const raw = serializeAnyNote(original);
    expect(raw.startsWith("veil-note-v1:")).toBe(true);

    const recovered = deserializeAnyNote(raw);
    expect(isBowNote(recovered)).toBe(false);
    if (isBowNote(recovered)) throw new Error("Expected legacy note");
    expect(recovered.nullifier).toBe(original.nullifier);
    expect(recovered.secret).toBe(original.secret);
    expect(recovered.nullifierHash).toBe(original.nullifierHash);
    expect(recovered.commitment).toBe(original.commitment);
    expect(recovered.denomination).toBe(original.denomination);
  });

  it("roundtrips a 0xbow note through the Any envelope with kind marker intact", () => {
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const original = createBowNote({
      scope,
      denomination: 1000000000000000n,
      label: 77n,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: 130200000n,
    });

    const raw = serializeAnyNote(original);
    expect(raw.startsWith("veil-bow-note-v1:")).toBe(true);

    const recovered = deserializeAnyNote(raw);
    expect(isBowNote(recovered)).toBe(true);
    if (!isBowNote(recovered)) throw new Error("Expected 0xbow note");
    expect(recovered.type).toBe("0xbow");
    expect(recovered.nullifier).toBe(original.nullifier);
    expect(recovered.secret).toBe(original.secret);
    expect(recovered.precommitment).toBe(original.precommitment);
    expect(recovered.label).toBe(original.label);
    expect(recovered.commitmentHash).toBe(original.commitmentHash);
    expect(recovered.scope).toBe(original.scope);
    expect(recovered.denomination).toBe(original.denomination);
  });

  it("roundtrips a mixed notes list without losing kinds", () => {
    const legacy = createShieldedNote(1000000000000000n);
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const bow = createBowNote({
      scope,
      denomination: 1000000000000000n,
      label: 78n,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0x1234",
      blockNumber: 130000000n,
    });

    const recovered = deserializeNotesList(serializeNotesList([bow, legacy]));
    expect(recovered).toHaveLength(2);
    expect(isBowNote(recovered[0])).toBe(true);
    expect(isBowNote(recovered[1])).toBe(false);
  });
});

describe("withdraw-path routing by note kind", () => {
  it("routes 0xbow notes to the 0xbow path", () => {
    const scope = 129954000n;
    const secrets = createBowDepositSecrets(scope);
    const bow = createBowNote({
      scope,
      denomination: 1000000000000000n,
      label: 79n,
      nullifier: secrets.nullifier,
      secret: secrets.secret,
      precommitment: secrets.precommitment,
      txHash: "0x1234",
      blockNumber: 130000000n,
    });
    expect(getWithdrawPath(bow)).toBe("0xbow");
  });

  it("routes legacy keccak notes to the legacy path", () => {
    const legacy = createShieldedNote(1000000000000000n);
    expect(getWithdrawPath(legacy)).toBe("legacy");
  });
});

describe("ASP set build includes user label plus sentinel", () => {
  it("keeps the depositor label and appends the sentinel", () => {
    const userLabel = 424242n;
    const set = buildBowAssociationSet([userLabel]);
    expect(set.labels).toContain(userLabel);
    expect(set.labels).toContain(BOW_ASP_SENTINEL_LABEL);
    expect(set.root).toBeTypeOf("bigint");
  });

  it("never duplicates the sentinel when it is already present", () => {
    const set = buildBowAssociationSet([BOW_ASP_SENTINEL_LABEL, 5n]);
    const sentinelCount = set.labels.filter((l) => l === BOW_ASP_SENTINEL_LABEL).length;
    expect(sentinelCount).toBe(1);
    expect(set.labels).toContain(5n);
  });
});

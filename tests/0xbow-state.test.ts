import { describe, it, expect } from "vitest";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import { buildBowStateTree, type BowStateTree } from "../lib/0xbow-client";
import { buildBowAssociationSet, buildBowAssociationProof, BOW_ASP_SENTINEL_LABEL } from "../lib/0xbow-association";

describe("0xbow Merkle Tree and Association Set Utilities", () => {
  it("builds a state tree from commitment leaves and generates membership proof", () => {
    const c1 = 12345678901234567890n;
    const c2 = 98765432109876543210n;
    const tree = buildBowStateTree([c1], [c2]);

    expect(tree.leaves).toHaveLength(2);
    expect(tree.root).toBeTypeOf("bigint");

    const proof1 = tree.proof(c1);
    expect(proof1).toBeDefined();
    expect(BigInt(proof1.root)).toBe(tree.root);

    const proof2 = tree.proof(c2);
    expect(proof2).toBeDefined();
    expect(BigInt(proof2.root)).toBe(tree.root);
  });

  it("builds association set with sentinel and produces valid membership proof", () => {
    const label1 = 1n;
    const label2 = 2n;
    const aspSet = buildBowAssociationSet([label1, label2]);

    expect(aspSet.labels).toContain(label1);
    expect(aspSet.labels).toContain(label2);
    expect(aspSet.labels).toContain(BOW_ASP_SENTINEL_LABEL);

    const proof = buildBowAssociationProof(aspSet, label1);
    expect(proof).toBeDefined();
    expect(BigInt(proof.root)).toBe(aspSet.root);
  });
});

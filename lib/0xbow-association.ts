// 0xbow testnet sentinel Association Set (Robinhood TESTNET 46630 ONLY).
// Ported from kentir lib/shielded-association.ts — copy, do not reinvent.
// Matches deployments/testnet-sentinel-asp-46630.json (sentinel-only genesis).
import { generateMerkleProof, type LeanIMTMerkleProof } from "@0xbow/privacy-pools-core-sdk";

export const BOW_SNARK_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const BOW_ASP_SENTINEL_LABEL = BOW_SNARK_FIELD - 1n;

/** Canonical testnet sentinel root (FIELD - 1, single-leaf LeanIMT). */
export const TESTNET_SENTINEL_ROOT = BOW_ASP_SENTINEL_LABEL;

export interface BowAssociationSet {
  labels: bigint[];
  root: bigint;
}

export function buildBowAssociationSet(inputLabels: bigint[]): BowAssociationSet {
  const seen = new Set<string>();
  for (const label of inputLabels) {
    if (label < 0n || label >= BOW_SNARK_FIELD) throw new Error("bow_asp_label_out_of_range");
    if (seen.has(label.toString())) throw new Error("bow_asp_duplicate_label");
    seen.add(label.toString());
  }
  const labels = [...inputLabels, ...(seen.has(BOW_ASP_SENTINEL_LABEL.toString()) ? [] : [BOW_ASP_SENTINEL_LABEL])].sort(
    (left, right) => (left < right ? -1 : left > right ? 1 : 0)
  );
  const proof = generateMerkleProof(labels, labels[0]);
  const root = BigInt(proof.root);
  if (root <= 0n || root >= BOW_SNARK_FIELD) throw new Error("bow_asp_invalid_root");
  return { labels, root };
}

export function buildBowAssociationProof(
  set: BowAssociationSet,
  label: bigint
): LeanIMTMerkleProof<bigint> {
  if (!set.labels.includes(label)) throw new Error("bow_asp_label_missing");
  const proof = generateMerkleProof(set.labels, label);
  if (BigInt(proof.root) !== set.root) throw new Error("bow_asp_root_mismatch");
  return proof;
}

/**
 * Testnet sentinel-only ASP matching deployments/testnet-sentinel-asp-46630.json.
 * Genesis policy: local sentinel only; withdrawals require postman-published labels.
 */
export function buildTestnetSentinelAssociationSet(): BowAssociationSet {
  return buildBowAssociationSet([]);
}

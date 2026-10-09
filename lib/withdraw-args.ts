import type { AnyShieldedNote, ShieldedNote } from "./note";
import { getWithdrawPath } from "./note";

// Legacy Mock proof for old notes only. Notes created before the audited
// 0xbow Groth16 pools can only exit through ShieldedVerifierMock, so this
// constant stays available for that legacy exit path. Never use it for
// 0xbow notes or new deposits: those take the SDK Groth16 path via
// buildBowRelayContext in lib/0xbow-client.ts.
// 4 bytes so it passes regardless of associationRoot (Mock requires
// proof.length >= 4 when associationRoot is zero).
export const LEGACY_MOCK_PROOF = "0x12345678" as const;

export interface WithdrawArgs {
  proof: `0x${string}`;
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  recipient: `0x${string}`;
  fee: bigint;
}

export function buildWithdrawArgs(
  note: AnyShieldedNote,
  root: `0x${string}`,
  recipient: `0x${string}`
): WithdrawArgs {
  if (getWithdrawPath(note) === "0xbow") {
    throw new Error("0xbow notes take the Groth16 relay path, not the legacy Mock withdraw.");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || recipient === "0x0000000000000000000000000000000000000000") {
    throw new Error("Recipient address is required");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
    throw new Error("Unknown Merkle root");
  }
  const legacyNote = note as ShieldedNote;
  return { proof: LEGACY_MOCK_PROOF, root, nullifierHash: legacyNote.nullifierHash, recipient, fee: 0n };
}

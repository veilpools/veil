import type { ShieldedNote } from "./note";

// Provisional proof accepted by ShieldedVerifierMock while the Groth16
// verifier (F4) is pending. Labeled as provisional in the UI.
// 4 bytes so it passes regardless of associationRoot (Mock requires
// proof.length >= 4 when associationRoot is zero).
export const PROVISIONAL_PROOF = "0x12345678" as const;

export interface WithdrawArgs {
  proof: `0x${string}`;
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  recipient: `0x${string}`;
  fee: bigint;
}

export function buildWithdrawArgs(
  note: ShieldedNote,
  root: `0x${string}`,
  recipient: `0x${string}`
): WithdrawArgs {
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || recipient === "0x0000000000000000000000000000000000000000") {
    throw new Error("Recipient address is required");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) {
    throw new Error("Unknown Merkle root");
  }
  return { proof: PROVISIONAL_PROOF, root, nullifierHash: note.nullifierHash, recipient, fee: 0n };
}

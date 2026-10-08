import { concatHex, keccak256, toHex, type Address } from "viem";
import { generateMnemonic, english } from "viem/accounts";
import {
  generateDepositSecrets,
  generateMasterKeys,
  hashPrecommitment,
  getCommitment,
} from "@0xbow/privacy-pools-core-sdk";

export interface ShieldedNote {
  secret: `0x${string}`;
  nullifier: `0x${string}`;
  nullifierHash: `0x${string}`;
  commitment: `0x${string}`;
  denomination: bigint;
  leafIndex?: number;
  timestamp: number;
  asset: `0x${string}`;
}

export interface BowShieldedNote {
  type: "0xbow";
  version: "v1.2.1";
  chainId: number;
  asset: `0x${string}`;
  denomination: bigint;
  nullifier: string;
  secret: string;
  precommitment: string;
  label: string;
  commitmentHash: string;
  txHash: string;
  blockNumber: string;
  scope: string;
  timestamp: number;
}

export type AnyShieldedNote = ShieldedNote | BowShieldedNote;

export function isBowNote(note: unknown): note is BowShieldedNote {
  return typeof note === "object" && note !== null && (note as BowShieldedNote).type === "0xbow";
}

export type WithdrawPath = "0xbow" | "legacy";

/** Pure withdraw-path router: 0xbow notes take the Groth16 path, everything else legacy. */
export function getWithdrawPath(note: AnyShieldedNote): WithdrawPath {
  return isBowNote(note) ? "0xbow" : "legacy";
}

export function generateRandomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function createShieldedNote(
  denomination: bigint,
  asset: `0x${string}` = "0x0000000000000000000000000000000000000000"
): ShieldedNote {
  const secret = generateRandomBytes32();
  const nullifier = generateRandomBytes32();
  const nullifierHash = keccak256(nullifier);
  const commitment = keccak256(concatHex([nullifier, secret]));

  return {
    secret,
    nullifier,
    nullifierHash,
    commitment,
    denomination,
    timestamp: Date.now(),
    asset: asset.toLowerCase() as `0x${string}`,
  };
}

export function serializeNote(note: ShieldedNote): string {
  return `veil-note-v1:${note.asset}:${note.denomination.toString()}:${note.nullifier}:${note.secret}`;
}

export function deserializeNote(noteString: string): ShieldedNote {
  const parts = noteString.trim().split(":");
  if (parts.length !== 5 || parts[0] !== "veil-note-v1") {
    throw new Error("Invalid Veil note format");
  }

  const asset = parts[1].toLowerCase() as `0x${string}`;
  const denomination = BigInt(parts[2]);
  const nullifier = parts[3] as `0x${string}`;
  const secret = parts[4] as `0x${string}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(nullifier) || !/^0x[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error("Invalid nullifier or secret length");
  }

  const nullifierHash = keccak256(nullifier);
  const commitment = keccak256(concatHex([nullifier, secret]));

  return {
    secret,
    nullifier,
    nullifierHash,
    commitment,
    denomination,
    timestamp: Date.now(),
    asset,
  };
}

export function createBowDepositSecrets(scope: bigint): {
  nullifier: bigint;
  secret: bigint;
  precommitment: bigint;
  mnemonic: string;
} {
  const mnemonic = generateMnemonic(english, 256);
  const keys = generateMasterKeys(mnemonic);
  const { nullifier, secret } = generateDepositSecrets(keys, scope as never, 0n);
  const precommitment = hashPrecommitment(nullifier, secret);
  return { nullifier: BigInt(nullifier), secret: BigInt(secret), precommitment: BigInt(precommitment), mnemonic };
}

export function createBowNote(input: {
  scope: bigint;
  denomination: bigint;
  label: bigint;
  nullifier: bigint;
  secret: bigint;
  precommitment: bigint;
  txHash: string;
  blockNumber: bigint;
  asset?: Address;
  chainId?: number;
}): BowShieldedNote {
  const commitment = getCommitment(
    input.denomination,
    input.label,
    input.nullifier as never,
    input.secret as never
  );
  const commitmentHash = (commitment.hash ?? commitment).toString();

  return {
    type: "0xbow",
    version: "v1.2.1",
    chainId: input.chainId ?? 46630,
    asset: (input.asset ?? "0x0000000000000000000000000000000000000000").toLowerCase() as `0x${string}`,
    denomination: input.denomination,
    nullifier: input.nullifier.toString(),
    secret: input.secret.toString(),
    precommitment: input.precommitment.toString(),
    label: input.label.toString(),
    commitmentHash,
    txHash: input.txHash,
    blockNumber: input.blockNumber.toString(),
    scope: input.scope.toString(),
    timestamp: Date.now(),
  };
}

export function serializeBowNote(note: BowShieldedNote): string {
  return `veil-bow-note-v1:${note.chainId}:${note.asset}:${note.denomination.toString()}:${note.scope}:${note.label}:${note.nullifier}:${note.secret}:${note.precommitment}:${note.commitmentHash}:${note.blockNumber}:${note.txHash}`;
}

export function deserializeBowNote(s: string): BowShieldedNote {
  const parts = s.trim().split(":");
  if (parts.length !== 12 || parts[0] !== "veil-bow-note-v1") {
    throw new Error("Invalid Veil 0xbow note format");
  }
  return {
    type: "0xbow",
    version: "v1.2.1",
    chainId: Number(parts[1]),
    asset: parts[2].toLowerCase() as `0x${string}`,
    denomination: BigInt(parts[3]),
    scope: parts[4],
    label: parts[5],
    nullifier: parts[6],
    secret: parts[7],
    precommitment: parts[8],
    commitmentHash: parts[9],
    blockNumber: parts[10],
    txHash: parts[11],
    timestamp: Date.now(),
  };
}

export function serializeAnyNote(note: AnyShieldedNote): string {
  if (isBowNote(note)) {
    return serializeBowNote(note);
  }
  return serializeNote(note);
}

export function deserializeAnyNote(raw: string): AnyShieldedNote {
  if (raw.startsWith("veil-bow-note-v1:")) {
    return deserializeBowNote(raw);
  }
  return deserializeNote(raw);
}

export function serializeNotesList(notes: AnyShieldedNote[]): string {
  return JSON.stringify(notes.map(serializeAnyNote));
}

export function deserializeNotesList(raw: string): AnyShieldedNote[] {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((item) => (typeof item === "string" ? deserializeAnyNote(item) : item));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Pending-note journal (root-audit F5): a note's secrets live only in memory
// between signing and persistence — a tab close/crash in that window strands
// funds (two such 0.001 ETH notes are permanently locked on testnet). Every
// deposit persists {payload, txHash} BEFORE waiting for receipt; success
// promotes into the vault, reconcilePendingNotes() heals crash leftovers on
// load. Same at-rest exposure as the vault itself (documented accepted risk).
// ---------------------------------------------------------------------------

export interface PendingNoteRecord {
  payload: string;
  nullifier: string;
  txHash: string;
  pool: string;
  savedAt: number;
}

const PENDING_KEY = "veil_pending_notes_v1";

function readPendingRaw(): PendingNoteRecord[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is PendingNoteRecord =>
        r !== null &&
        typeof r === "object" &&
        typeof r.payload === "string" &&
        typeof r.txHash === "string"
    );
  } catch {
    return [];
  }
}

export function loadPendingNotes(): PendingNoteRecord[] {
  return readPendingRaw();
}

/** Journal a note BEFORE awaiting its receipt. Overwrites same-nullifier entries. */
export function savePendingNote(note: AnyShieldedNote, txHash: string, pool: string): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const next = readPendingRaw().filter((r) => r.nullifier !== note.nullifier);
    next.push({
      payload: serializeAnyNote(note),
      nullifier: note.nullifier,
      txHash,
      pool,
      savedAt: Date.now(),
    });
    localStorage.setItem(PENDING_KEY, JSON.stringify(next));
  } catch {
    // Journal is best-effort; the confirmed-save path remains authoritative.
  }
}

export function clearPendingNoteByTx(txHash: string): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const next = readPendingRaw().filter(
      (r) => r.txHash.toLowerCase() !== txHash.toLowerCase()
    );
    localStorage.setItem(PENDING_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

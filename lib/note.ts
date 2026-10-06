import { concatHex, keccak256, toHex } from "viem";

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

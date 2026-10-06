const BACKUP_VERSION = 1;
const BACKUP_AAD = new TextEncoder().encode("veil-shield-note-backup:v1");
const PBKDF2_ITERATIONS = 310_000;

export interface EncryptedNoteBackup {
  version: 1;
  kdf: "PBKDF2-SHA256";
  cipher: "AES-256-GCM";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptNoteBackup(notePayload: string, password: string): Promise<EncryptedNoteBackup> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const key = await deriveKey(password, salt);
  const encodedPayload = new TextEncoder().encode(notePayload);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(BACKUP_AAD),
      tagLength: 128,
    },
    key,
    toArrayBuffer(encodedPayload)
  );

  return {
    version: BACKUP_VERSION,
    kdf: "PBKDF2-SHA256",
    cipher: "AES-256-GCM",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decryptNoteBackup(backup: EncryptedNoteBackup, password: string): Promise<string> {
  if (backup.version !== BACKUP_VERSION || backup.cipher !== "AES-256-GCM") {
    throw new Error("Unsupported backup format");
  }

  const salt = fromBase64(backup.salt);
  const iv = fromBase64(backup.iv);
  const ciphertext = fromBase64(backup.ciphertext);

  const key = await deriveKey(password, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(BACKUP_AAD),
        tagLength: 128,
      },
      key,
      toArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error("Failed to decrypt note backup: incorrect password or corrupted data");
  }
}

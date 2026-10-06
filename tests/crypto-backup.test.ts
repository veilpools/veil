import { describe, it, expect } from "vitest";
import { encryptNoteBackup, decryptNoteBackup } from "../lib/crypto-backup";
import { createShieldedNote, serializeNote } from "../lib/note";
import { parseEther } from "viem";

describe("Encrypted Note Backup (PBKDF2 + AES-256-GCM)", () => {
  it("encrypts and decrypts a note backup with valid password", async () => {
    const note = createShieldedNote(parseEther("0.001"));
    const serialized = serializeNote(note);
    const password = "strong-password-123";

    const encrypted = await encryptNoteBackup(serialized, password);

    expect(encrypted.version).toBe(1);
    expect(encrypted.kdf).toBe("PBKDF2-SHA256");
    expect(encrypted.cipher).toBe("AES-256-GCM");
    expect(encrypted.iterations).toBe(310000);
    expect(typeof encrypted.salt).toBe("string");
    expect(typeof encrypted.iv).toBe("string");
    expect(typeof encrypted.ciphertext).toBe("string");

    const decrypted = await decryptNoteBackup(encrypted, password);
    expect(decrypted).toBe(serialized);
  });

  it("fails decryption when incorrect password is provided", async () => {
    const note = createShieldedNote(parseEther("0.001"));
    const serialized = serializeNote(note);
    const encrypted = await encryptNoteBackup(serialized, "correct-password");

    await expect(decryptNoteBackup(encrypted, "wrong-password")).rejects.toThrow(
      "Failed to decrypt note backup"
    );
  });

  it("rejects password with insufficient length", async () => {
    await expect(encryptNoteBackup("sample", "short")).rejects.toThrow(
      "Password must be at least 8 characters long"
    );
  });
});

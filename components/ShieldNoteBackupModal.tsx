"use client";

import React, { useState } from "react";
import { Lock, Download, Copy, Check, X, ShieldAlert } from "lucide-react";
import { encryptNoteBackup, decryptNoteBackup, type EncryptedNoteBackup } from "../lib/crypto-backup";
import { serializeNote, deserializeNote, type ShieldedNote } from "../lib/note";
import { ModalWrapper } from "./ModalWrapper";

interface Props {
  note: ShieldedNote | null;
  isOpen: boolean;
  onClose: () => void;
  onRestoreNote?: (note: ShieldedNote) => void;
}

export function ShieldNoteBackupModal({ note, isOpen, onClose, onRestoreNote }: Props) {
  const [mode, setMode] = useState<"export" | "import">("export");
  const [password, setPassword] = useState("");
  const [encryptedPayload, setEncryptedPayload] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEncrypt() {
    if (!note) return;
    setError(null);
    try {
      const raw = serializeNote(note);
      const backup = await encryptNoteBackup(raw, password);
      setEncryptedPayload(JSON.stringify(backup, null, 2));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Encryption failed");
    }
  }

  async function handleDecryptAndRestore() {
    setError(null);
    try {
      const backup = JSON.parse(importJson) as EncryptedNoteBackup;
      const decrypted = await decryptNoteBackup(backup, password);
      const restored = deserializeNote(decrypted);
      if (onRestoreNote) {
        onRestoreNote(restored);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    }
  }

  function handleCopy() {
    if (!encryptedPayload) return;
    navigator.clipboard.writeText(encryptedPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="480px"
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "rgba(255, 140, 0, 0.12)",
                border: "1px solid rgba(255, 140, 0, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-accent)",
              }}
            >
              <Lock className="w-4 h-4 text-[#FF8C00]" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
                Encrypted Note Backup
              </h3>
              <p style={{ margin: 0, fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
                Client-side AES-GCM key preservation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close backup modal"
            style={{
              background: "rgba(26, 26, 26, 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              padding: "6px",
              color: "var(--color-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-2)",
            backgroundColor: "rgba(26, 26, 26, 0.05)",
            padding: "4px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <button
            onClick={() => { setMode("export"); setError(null); }}
            style={{
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-caption)",
              fontFamily: "var(--font-body)",
              fontWeight: mode === "export" ? 600 : 400,
              cursor: "pointer",
              border: mode === "export" ? "1px solid var(--color-accent)" : "none",
              backgroundColor: mode === "export" ? "rgba(255, 140, 0, 0.15)" : "transparent",
              color: mode === "export" ? "var(--color-accent)" : "var(--color-muted)",
              transition: "all var(--duration-fast)",
            }}
          >
            Export Backup
          </button>
          <button
            onClick={() => { setMode("import"); setError(null); }}
            style={{
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-caption)",
              fontFamily: "var(--font-body)",
              fontWeight: mode === "import" ? 600 : 400,
              cursor: "pointer",
              border: mode === "import" ? "1px solid var(--color-accent)" : "none",
              backgroundColor: mode === "import" ? "rgba(255, 140, 0, 0.15)" : "transparent",
              color: mode === "import" ? "var(--color-accent)" : "var(--color-muted)",
              transition: "all var(--duration-fast)",
            }}
          >
            Restore Note
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(255, 106, 123, 0.1)",
              border: "1px solid rgba(255, 106, 123, 0.3)",
              color: "#c0283c",
              fontSize: "var(--text-caption)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === "export" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontWeight: 500 }}>
                Encryption Password
              </label>
              <input
                type="password"
                placeholder="Enter password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.04)",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-text)",
                  fontSize: "var(--text-body-sm)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleEncrypt}
              disabled={password.length < 8}
              className="lp-btn lp-btn--accent"
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "2.75rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: "var(--color-accent)",
                color: "var(--color-accent-contrast)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: password.length < 8 ? "not-allowed" : "pointer",
                opacity: password.length < 8 ? 0.4 : 1,
              }}
            >
              Generate Encrypted Backup (AES-GCM)
            </button>

            {encryptedPayload && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>Encrypted JSON Payload</span>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--color-accent)",
                      cursor: "pointer",
                      fontSize: "var(--text-caption)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: 600,
                    }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "rgba(26, 26, 26, 0.04)",
                    border: "1px solid var(--color-border)",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "var(--color-text)",
                    maxHeight: "140px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    margin: 0,
                  }}
                >
                  {encryptedPayload}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontWeight: 500 }}>
                Paste Encrypted Backup JSON
              </label>
              <textarea
                rows={4}
                placeholder='{"ciphertext": "...", "salt": "...", "iv": "..."}'
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.04)",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-text)",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontWeight: 500 }}>
                Decryption Password
              </label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "rgba(26, 26, 26, 0.04)",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-text)",
                  fontSize: "var(--text-body-sm)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={handleDecryptAndRestore}
              disabled={!importJson || !password}
              className="lp-btn lp-btn--accent"
              style={{
                width: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "2.75rem",
                borderRadius: "var(--radius-md)",
                border: "none",
                backgroundColor: "var(--color-accent)",
                color: "var(--color-accent-contrast)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                cursor: !importJson || !password ? "not-allowed" : "pointer",
                opacity: !importJson || !password ? 0.4 : 1,
              }}
            >
              Decrypt &amp; Restore Note
            </button>
          </div>
        )}
    </ModalWrapper>
  );
}

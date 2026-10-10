"use client";

import React, { useState } from "react";
import { Copy, Download } from "lucide-react";
import { isBowNote, type AnyShieldedNote } from "../../lib/note";
import { formatNoteAmount, getNoteAssetSymbol } from "../../lib/note-format";

export interface VaultPanelProps {
  notes: AnyShieldedNote[];
  onBackup: () => void;
  onBackupNote: (nullifier: string) => void;
  onWithdrawNote: (nullifier: string) => void;
  onRemoveNote: (nullifier: string) => void;
}

/** Vault tab: local encrypted-note list with copy + withdraw shortcuts. */
export const VaultPanel: React.FC<VaultPanelProps> = ({ notes, onBackup, onBackupNote, onWithdrawNote, onRemoveNote }) => {
  const [copiedCommitment, setCopiedCommitment] = useState<string | null>(null);
  // Two-step remove: first click arms, second click removes. Guards against
  // fat-finger loss (the encrypted backup lives separately, but re-adding
  // needs a manual restore).
  const [armedRemove, setArmedRemove] = useState<string | null>(null);

  function handleCopyCommitment(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedCommitment(text);
    setTimeout(() => setCopiedCommitment(null), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Active Encrypted Notes ({notes.length})
        </span>
        <button
          onClick={onBackup}
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            minHeight: "24px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "rgba(26, 26, 26, 0.04)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            fontSize: "var(--text-caption)",
            cursor: "pointer",
            fontWeight: 600,
            transition: "all var(--duration-fast)",
          }}
        >
          <Download className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          <span>Backup JSON</span>
        </button>
      </div>

      {notes.length === 0 ? (
        <div
          style={{
            padding: "var(--space-8)",
            textAlign: "center",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.02)",
            border: "1px dashed var(--color-border-strong)",
            color: "var(--color-muted)",
            fontSize: "var(--text-body-sm)",
          }}
        >
          No active shielded notes. Use Shield to create your first encrypted commitment.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {notes.map((note, index) => (
            <div
              key={note.nullifier}
              style={{
                padding: "var(--space-4) var(--space-5)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-border-strong)",
                boxShadow: "0 2px 8px rgba(26, 26, 26, 0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: "var(--text-body)" }}>
                    Note #{index + 1}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "rgba(255, 140, 0, 0.1)",
                      border: "1px solid rgba(255, 140, 0, 0.25)",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "var(--color-accent-ink)",
                      fontWeight: 600,
                    }}
                  >
                    {getNoteAssetSymbol(note.asset)}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "rgba(26, 26, 26, 0.04)",
                      border: "1px solid var(--color-border)",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "var(--color-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {isBowNote(note) ? "0xbow v1.2.1 · Groth16" : "Legacy · Depth 20"}
                  </span>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: "1.1rem", color: "var(--color-accent-ink)", fontWeight: 700 }}>
                  {formatNoteAmount(note.denomination, note.asset)}
                </span>
              </div>

              <div
                style={{
                  backgroundColor: "rgba(26, 26, 26, 0.025)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              >
                {(() => {
                  const commitmentStr = isBowNote(note) ? note.commitmentHash : note.commitment;
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--color-muted)" }}>Commitment:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                          {commitmentStr.slice(0, 12)}...{commitmentStr.slice(-8)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommitment(commitmentStr)}
                          title="Copy full commitment hash"
                          aria-label="Copy full commitment hash"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--color-accent-ink)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontWeight: 600,
                            padding: "4px 8px",
                            minHeight: "24px",
                            borderRadius: "4px",
                          }}
                        >
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>{copiedCommitment === commitmentStr ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--color-muted)" }}>Nullifier:</span>
                  <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
                    {note.nullifier.slice(0, 12)}...{note.nullifier.slice(-8)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                  Storage: Encrypted Local CSPRNG
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => onBackupNote(note.nullifier)}
                    aria-label={`Back up note ${index + 1} as encrypted JSON`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      minHeight: "24px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "transparent",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-muted)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all var(--duration-fast)",
                    }}
                  >
                    <span>Backup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onWithdrawNote(note.nullifier)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 12px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(26, 26, 26, 0.04)",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-text)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all var(--duration-fast)",
                  }}
                >
                    <span>Withdraw Note ➔</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (armedRemove === note.nullifier) {
                        setArmedRemove(null);
                        onRemoveNote(note.nullifier);
                      } else {
                        setArmedRemove(note.nullifier);
                      }
                    }}
                    title="Remove a spent or duplicate note from this vault (back up first)"
                    aria-label={`Remove note ${index + 1} from vault`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 12px",
                      minHeight: "24px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: armedRemove === note.nullifier ? "rgba(180, 35, 24, 0.08)" : "transparent",
                      border: "1px solid var(--color-border)",
                      color: armedRemove === note.nullifier ? "#b42318" : "var(--color-muted)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all var(--duration-fast)",
                    }}
                  >
                    <span>{armedRemove === note.nullifier ? "Confirm remove" : "Remove"}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VaultPanel;

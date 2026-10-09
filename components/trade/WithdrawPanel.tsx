"use client";

import React from "react";
import { isAddress } from "viem";
import { Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { APP_CHAIN_ID } from "../../lib/chains";
import { TESTNET_CHAIN_ID } from "../../lib/privacy-pools";
import { isBowNote, type AnyShieldedNote } from "../../lib/note";
import { formatNoteAmount } from "../../lib/note-format";

export interface WithdrawPanelProps {
  notes: AnyShieldedNote[];
  activeNote: AnyShieldedNote | undefined;
  isNoteDropdownOpen: boolean;
  onToggleNoteDropdown: () => void;
  onSelectNote: (nullifier: string) => void;
  cleanRecipient: string;
  onRecipientChange: (value: string) => void;
  isExecuting: boolean;
  onWithdraw: () => void;
}

/** Withdraw tab: note picker, clean recipient, unlinkable-withdraw CTA. */
export const WithdrawPanel: React.FC<WithdrawPanelProps> = ({
  notes,
  activeNote,
  isNoteDropdownOpen,
  onToggleNoteDropdown,
  onSelectNote,
  cleanRecipient,
  onRecipientChange,
  isExecuting,
  onWithdraw,
}) => {
  const recipientInvalid = cleanRecipient.length > 0 && !isAddress(cleanRecipient);
  const ctaDisabled =
    isExecuting || !cleanRecipient || !isAddress(cleanRecipient) || notes.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Note Selection Surface */}
      <div
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "rgba(26, 26, 26, 0.025)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            htmlFor="withdraw-note-select"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Select Shielded Note to Withdraw
          </label>
          <span style={{ fontSize: "11px", color: "var(--color-accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>
            {notes.length} Available
          </span>
        </div>

        {notes.length === 0 || !activeNote ? (
          <div
            style={{
              padding: "var(--space-5)",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 140, 0, 0.06)",
              border: "1px dashed rgba(255, 140, 0, 0.35)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <Lock className="w-5 h-5 text-[#FF8C00]" aria-hidden="true" />
            <div style={{ color: "var(--color-text)", fontWeight: 600, fontSize: "var(--text-body-sm)" }}>
              No Shielded Notes to Withdraw
            </div>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)" }}>
              You have no active notes in encrypted local storage.
            </p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              id="withdraw-note-select"
              onClick={onToggleNoteDropdown}
              aria-haspopup="true"
              aria-expanded={isNoteDropdownOpen}
              aria-label="Selected shielded note, change note"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "#ffffff",
                border: isNoteDropdownOpen ? "1px solid var(--color-accent)" : "1px solid var(--color-border-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left",
                transition: "all var(--duration-fast)",
                boxSizing: "border-box",
                boxShadow: "0 2px 6px rgba(26, 26, 26, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(26, 26, 26, 0.04)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-muted)",
                    flexShrink: 0,
                  }}
                >
                  <Lock className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "var(--text-body-sm)" }}>
                      Note #{notes.findIndex((n) => n.nullifier === activeNote.nullifier) + 1}
                    </span>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: "rgba(26, 26, 26, 0.04)",
                        border: "1px solid var(--color-border)",
                        fontSize: "10px",
                        fontFamily: "monospace",
                        color: "var(--color-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {isBowNote(activeNote) ? "0xbow v1.2.1 · Groth16" : "Old note · legacy exit"}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                    Nullifier: {activeNote.nullifier.slice(0, 12)}...{activeNote.nullifier.slice(-6)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: "var(--color-accent-ink)", fontWeight: 700 }}>
                  {formatNoteAmount(activeNote.denomination, activeNote.asset)}
                </span>
                {isNoteDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                )}
              </div>
            </button>

            {/* Dropdown Popover */}
            {isNoteDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  backgroundColor: "#ffffff",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "0 16px 36px rgba(26, 26, 26, 0.15)",
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "4px",
                }}
              >
                {notes.map((n, idx) => {
                  const isCurrent = n.nullifier === activeNote.nullifier;
                  return (
                    <button
                      key={n.nullifier}
                      type="button"
                      onClick={() => onSelectNote(n.nullifier)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: isCurrent ? "rgba(26, 26, 26, 0.05)" : "transparent",
                        border: isCurrent ? "1px solid var(--color-border-strong)" : "1px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        textAlign: "left",
                        marginBottom: "2px",
                        transition: "all var(--duration-fast)",
                        boxSizing: "border-box",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "12px" }}>
                            Note #{idx + 1}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                            {n.nullifier.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-text)", fontWeight: 600 }}>
                          {formatNoteAmount(n.denomination, n.asset)}
                        </span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-[#FF8C00]" aria-hidden="true" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipient Address Surface */}
      <div
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "rgba(26, 26, 26, 0.025)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            htmlFor="clean-recipient"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Clean Recipient Address (0 Linkage)
          </label>
          <span style={{ fontSize: "10px", color: "var(--color-muted)", fontFamily: "monospace", fontWeight: 500 }}>
            Relayer Dispatched
          </span>
        </div>
        <input
          id="clean-recipient"
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={recipientInvalid}
          aria-describedby={recipientInvalid ? "clean-recipient-error" : "clean-recipient-help"}
          placeholder="0x... (fresh or unlinked wallet address)"
          value={cleanRecipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          style={{
            width: "100%",
            padding: "11px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "#ffffff",
            border: recipientInvalid
              ? "1px solid var(--color-danger-border)"
              : "1px solid var(--color-border-strong)",
            color: "var(--color-text)",
            fontSize: "16px",
            fontFamily: "monospace",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color var(--duration-fast)",
          }}
        />
        {recipientInvalid && (
          <span id="clean-recipient-error" role="status" style={{ fontSize: "11px", color: "var(--color-danger-ink)" }}>
            Not a valid address — expected 0x followed by 40 hexadecimal characters.
          </span>
        )}
        <span id="clean-recipient-help" style={{ fontSize: "11px", color: "var(--color-muted)" }}>
          {APP_CHAIN_ID === TESTNET_CHAIN_ID
            ? "The withdraw call carries no depositor address. Unlinkable withdrawal with client-side Groth16 ZK-SNARK verification."
            : "The withdraw call carries no depositor address. Provisional verifier for old notes only — Groth16 on 0xbow paths."}
        </span>
      </div>

      <button
        onClick={onWithdraw}
        disabled={ctaDisabled}
        className="group active:scale-[0.99] transition-all"
        style={{
          width: "100%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body)",
          fontWeight: 600,
          minHeight: "3.25rem",
          borderRadius: "var(--radius-md)",
          border: "none",
          backgroundColor: "var(--color-accent)",
          color: "var(--color-accent-contrast)",
          cursor: ctaDisabled ? "not-allowed" : "pointer",
          opacity: ctaDisabled ? 0.45 : 1,
          boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
          transition: "all var(--duration-fast)",
        }}
      >
        <span>{isExecuting ? "Synthesizing Proof & Dispatched..." : "Prove & Withdraw Unlinkable"}</span>
      </button>
    </div>
  );
};

export default WithdrawPanel;

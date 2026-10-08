"use client";

import React from "react";
import { formatEther } from "viem";
import { ArrowRightLeft, Check, ChevronDown, ChevronUp, Lock } from "lucide-react";
import type { AnyShieldedNote } from "../../lib/note";
import { ETH_ZERO_ADDRESS } from "../../lib/note-format";
import { formatNoteAmount } from "../../lib/note-format";
import {
  SHIELDED_SWAP_DESTINATION_POOL,
  SHIELDED_SWAP_SOURCE_DENOMINATION,
  SHIELDED_SWAP_SOURCE_POOL,
  type ShieldedSwapRouteStatus,
} from "../../lib/shielded-swap-ui";
import { TESTNET_LEGACY_ETH_POOL } from "../../lib/router-swap";
import type { TokenItem } from "../TokenSelectModal";

export interface ShieldedSwapPanelProps {
  notes: AnyShieldedNote[];
  activeNote: AnyShieldedNote | undefined;
  isNoteDropdownOpen: boolean;
  onToggleNoteDropdown: () => void;
  onSelectNote: (nullifier: string) => void;
  onGoShield: () => void;
  outputToken: TokenItem;
  onChangePool: () => void;
  route: ShieldedSwapRouteStatus;
  ethDenomination: bigint | null;
  shieldedSwapTxHash: string | null;
  explorerTxUrl: (hash: string) => string;
  shieldedSwapDisabled: boolean;
  isSwapping: boolean;
  connected: boolean;
  onExecute: () => void;
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Shielded-swap tab: spend-note picker, target pool, live route, execute. */
export const ShieldedSwapPanel: React.FC<ShieldedSwapPanelProps> = ({
  notes,
  activeNote,
  isNoteDropdownOpen,
  onToggleNoteDropdown,
  onSelectNote,
  onGoShield,
  outputToken,
  onChangePool,
  route,
  ethDenomination,
  shieldedSwapTxHash,
  explorerTxUrl,
  shieldedSwapDisabled,
  isSwapping,
  connected,
  onExecute,
}) => {
  const isEthSource =
    !activeNote?.asset || activeNote.asset === ETH_ZERO_ADDRESS;
  const sourceLabel = isEthSource
    ? `ShieldedPool_ETH ${short(TESTNET_LEGACY_ETH_POOL)} · ${
        ethDenomination !== null ? `${formatEther(ethDenomination)} ETH` : "…"
      }/note`
    : `ShieldedPool_VEIL2 ${short(SHIELDED_SWAP_SOURCE_POOL)} · ${formatEther(
        SHIELDED_SWAP_SOURCE_DENOMINATION
      )} VEIL/note`;
  const destLabel = route.destination
    ? isEthSource
      ? `ShieldedPool_VEIL ${short(route.destination)} · VEIL/note (denomination checked live)`
      : `ShieldedPool_ETH ${short(SHIELDED_SWAP_DESTINATION_POOL)} · 0.001 ETH/note`
    : "Pending — route not executable";

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
            htmlFor="shielded-swap-note-select"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Spend Shielded Note (Private)
          </label>
          <span style={{ fontSize: "11px", color: "var(--color-accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>
            {notes.length} Notes Available
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
              No Shielded Notes in Vault
            </div>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)" }}>
              Perform a Swap-to-Shield transaction first to create your initial private commitment note.
            </p>
            <button
              type="button"
              onClick={onGoShield}
              style={{
                marginTop: "var(--space-2)",
                padding: "6px 14px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(255, 140, 0, 0.15)",
                border: "1px solid rgba(255, 140, 0, 0.35)",
                color: "var(--color-accent-ink)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                minHeight: "24px",
              }}
            >
              Go to Swap-to-Shield ➔
            </button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              id="shielded-swap-note-select"
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
                      Legacy note
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

      {/* Direction Divider */}
      <div style={{ display: "flex", justifyContent: "center", margin: "-8px 0", position: "relative", zIndex: 5 }}>
        <div
          aria-hidden="true"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-muted)",
            boxShadow: "0 2px 8px rgba(26, 26, 26, 0.06)",
          }}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      </div>

      {/* Target Shielded Pool Surface */}
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
            htmlFor="pool-target-select"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Target Shielded Pool
          </label>
          <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
            Merkle Commitment Mint
          </span>
        </div>

        <button
          type="button"
          id="pool-target-select"
          onClick={onChangePool}
          aria-label="Target shielded pool, change pool"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-border-strong)",
            boxShadow: "0 2px 6px rgba(26, 26, 26, 0.05)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all var(--duration-fast)",
            width: "100%",
            boxSizing: "border-box",
          }}
          className="hover:border-[#FF8C00] transition-colors"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "#ffffff",
                border: "1px solid var(--color-border)",
                boxShadow: "0 2px 5px rgba(26, 26, 26, 0.05)",
                padding: "6px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              <div style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {outputToken.iconSvg}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-text)", fontWeight: 600, display: "block" }}>
                {outputToken.symbol} Shielded Pool
              </span>
              <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
                Denomination: {outputToken.poolDenomination || "1,000"} · LeanIMT Depth 20
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--color-accent-ink)",
                backgroundColor: "rgba(255, 140, 0, 0.08)",
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255, 140, 0, 0.2)",
                fontWeight: 600,
              }}
            >
              Change Pool
            </span>
            <ChevronDown className="w-4 h-4 text-[#FF8C00]" aria-hidden="true" />
          </div>
        </button>
      </div>

      {/* Live route: source follows the spend note, destination is live-read. */}
      <div
        role="status"
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "rgba(26, 26, 26, 0.025)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          fontSize: "var(--text-caption)",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Source:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>
            {sourceLabel}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Swap leg:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right" }}>
            v4 {isEthSource ? "ETH/VEIL" : "VEIL/ETH"} 0.3% via shieldedSwap
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Destination:</span>
          <span style={{ color: "var(--color-accent-ink)", fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>
            {destLabel}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Relay:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right" }}>
            Self-relay (you pay gas, fee 0)
          </span>
        </div>
        <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
          No hosted relayer service exists on testnet — and none is claimed. If the
          relayer path ever goes down, this self-relay path is the fallback (§7 #6).
          Execution re-checks both pools and the route live before sending; your
          spent note rolls into a new note in your vault.
        </span>
        {shieldedSwapTxHash && (
          <span style={{ overflowWrap: "anywhere" }}>
            <span style={{ color: "var(--color-muted)" }}>Shielded swap tx: </span>
            <a href={explorerTxUrl(shieldedSwapTxHash)} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-ink)" }}>
              {shieldedSwapTxHash}
            </a>
          </span>
        )}
      </div>

      <button
        onClick={onExecute}
        disabled={shieldedSwapDisabled}
        aria-label="Execute shielded swap via VeilShieldRouter"
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
          cursor: shieldedSwapDisabled ? "not-allowed" : "pointer",
          opacity: shieldedSwapDisabled ? 0.45 : 1,
          boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
          transition: "all var(--duration-fast)",
        }}
      >
        <span>
          {!connected
            ? "Connect Wallet to Trade"
            : notes.length === 0
            ? "No Notes in Vault"
            : !route.executable
            ? "Destination Pool Pending"
            : isSwapping
            ? "Executing Shielded Swap..."
            : "Execute Shielded Swap (Private ➔ Private)"}
        </span>
      </button>
    </div>
  );
};

export default ShieldedSwapPanel;

"use client";

import React from "react";

export interface ZkShieldedSwapNoteOption {
  nullifier: string;
  label: string;
  assetSymbol: "ETH" | "VEIL";
}

export interface ZkShieldedSwapPanelProps {
  connectedAddress: string | null;
  notes: ZkShieldedSwapNoteOption[];
  selectedNullifier: string;
  onSelectNote: (nullifier: string) => void;
  sourceLabel: string;
  destinationLabel: string;
  routeLabel: string;
  routerAddress: string;
  multiRouterAddress: string;
  quotedOut: string | null;
  minSwapOut: string | null;
  flowKind: "single" | "multi" | "direct" | null;
  isQuoting: boolean;
  isExecuting: boolean;
  quoteDisabled: boolean;
  executeDisabled: boolean;
  quoteNote: string | null;
  txHash: string | null;
  onQuote: () => void;
  onExecute: () => void;
  payoutAddress: string;
  onPayoutAddressChange: (value: string) => void;
}

/** Shielded Swap tab: atomic relay -> swap -> deposit via the ZK routers. */
export const ZkShieldedSwapPanel: React.FC<ZkShieldedSwapPanelProps> = ({
  connectedAddress,
  notes,
  selectedNullifier,
  onSelectNote,
  sourceLabel,
  destinationLabel,
  routeLabel,
  routerAddress,
  multiRouterAddress,
  quotedOut,
  minSwapOut,
  flowKind,
  isQuoting,
  isExecuting,
  quoteDisabled,
  executeDisabled,
  quoteNote,
  txHash,
  onQuote,
  onExecute,
  payoutAddress,
  onPayoutAddressChange,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
          <span style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            You Spend (Shielded Note)
          </span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
            Groth16 relay-in-tx
          </span>
        </div>
        <label
          htmlFor="zk-shielded-swap-note"
          style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "var(--font-body)" }}
        >
          Source note picker (0xbow ETH or VEIL notes from your vault)
        </label>
        <select
          id="zk-shielded-swap-note"
          aria-label="Select source shielded note"
          value={selectedNullifier}
          onChange={(e) => onSelectNote(e.target.value)}
          disabled={notes.length === 0 || isQuoting || isExecuting}
          style={{
            minHeight: "2.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border-strong)",
            backgroundColor: "#ffffff",
            color: "var(--color-text)",
            fontFamily: "monospace",
            fontSize: "var(--text-caption)",
            padding: "0 var(--space-3)",
            cursor: notes.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {notes.length === 0 && <option value="">No 0xbow notes in vault</option>}
          {notes.map((n) => (
            <option key={n.nullifier} value={n.nullifier}>
              {n.label}
            </option>
          ))}
        </select>
        <div
          style={{
            fontSize: "clamp(1.4rem, 2vw, 1.8rem)",
            fontFamily: "var(--font-headline)",
            fontWeight: 600,
            color: "var(--color-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {sourceLabel}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
          <span>{routeLabel}</span>
          <span>Atomic, one tx</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "var(--text-caption)",
            color: "var(--color-muted)",
            fontFamily: "monospace",
            borderTop: "1px solid var(--color-border)",
            paddingTop: "var(--space-3)",
          }}
        >
          <span>You receive (fixed destination):</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{destinationLabel}</span>
        </div>
      </div>

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
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Live swap quote:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {isQuoting ? "Simulating live output…" : quotedOut ?? "Not quoted yet"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Slippage-bound minSwapOut:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {minSwapOut ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Flow:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {flowKind === "multi" ? "Batched (multi-note)" : flowKind === "single" ? "Single note" : flowKind === "direct" ? "Direct payout (visible onchain)" : "—"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Router:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, overflowWrap: "anywhere" }}>
            {flowKind === "multi" ? multiRouterAddress : routerAddress}
          </span>
        </div>
        <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)", lineHeight: 1.5, overflowWrap: "anywhere", minWidth: 0 }}>
          {quoteNote ??
            "Quote runs free exact-calldata simulations (no transaction), then bounds the live output by your Execution Settings slippage. One note funds the destination when possible, otherwise a same-asset batch is quoted. Execution re-simulates immediately before sending and fails closed on any revert."}
        </span>
        {txHash && (
          <span style={{ color: "var(--color-muted)", overflowWrap: "anywhere" }}>
            Full-ZK tx: {txHash}
          </span>
        )}
      </div>
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "rgba(26, 26, 26, 0.025)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <label
            htmlFor="direct-payout-address"
            style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Payout address (receives the swap output directly)
          </label>
          <input
            id="direct-payout-address"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x... (your clean wallet address)"
            value={payoutAddress}
            onChange={(e) => onPayoutAddressChange(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text)",
              fontSize: "16px",
              fontFamily: "monospace",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--color-muted)" }}>
            Optional — only used for Direct payout. Empty means your connected wallet.
          </span>
        </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button
          type="button"
          onClick={onQuote}
          disabled={quoteDisabled}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            minHeight: "3rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border-strong)",
            backgroundColor: "#ffffff",
            color: "var(--color-text)",
            cursor: quoteDisabled ? "not-allowed" : "pointer",
            opacity: quoteDisabled ? 0.45 : 1,
            transition: "all var(--duration-fast)",
          }}
        >
          <span>{isQuoting ? "Quoting…" : "Refresh Live Quote"}</span>
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={executeDisabled}
          className="group active:scale-[0.99] transition-all"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-sm)",
            fontWeight: 600,
            minHeight: "3rem",
            borderRadius: "var(--radius-md)",
            border: "none",
            backgroundColor: "var(--color-accent)",
            color: "var(--color-accent-contrast)",
            cursor: executeDisabled ? "not-allowed" : "pointer",
            opacity: executeDisabled ? 0.45 : 1,
            boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
            transition: "all var(--duration-fast)",
          }}
        >
          <span>
            {isExecuting
              ? "Executing Full-ZK…"
              : !connectedAddress
              ? "Connect Wallet to Trade"
              : "Execute Full-ZK Flow"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default ZkShieldedSwapPanel;

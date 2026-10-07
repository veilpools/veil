"use client";

import React from "react";
import {
  GATED_EXPLORER_ADDRESS_BASE,
  GATED_EXPLORER_TX_BASE,
  GATED_HOOK_ADDRESS,
  GATED_POOL_ID,
  GATED_REGISTRY_ADDRESS,
  isGatedExecuteDisabled,
  PROVEN_GATED_VEIL_AMOUNT_IN,
  type AttestationStatus,
  type GatingConfig,
} from "../../lib/gated-attest";

export interface AttestPanelProps {
  connectedAddress: string | null;
  attestation: AttestationStatus | null;
  gating: GatingConfig | null;
  isAttestLoading: boolean;
  isAttesting: boolean;
  onSelfAttest: () => void;
  onRefresh: () => void;
  attestNote: string | null;
  attestTxHash: string | null;
  gatedAmountIn: string;
  onGatedAmountIn: (v: string) => void;
  gatedValid: boolean;
  isSimulatingGated: boolean;
  isGatedSwapping: boolean;
  onSimulate: () => void;
  onGatedSwap: () => void;
  gatedSimNote: string | null;
  gatedTxHash: string | null;
}

/** Self-attestation + gated-pool region inside the Buy & Shield tab. */
export const AttestPanel: React.FC<AttestPanelProps> = ({
  connectedAddress,
  attestation,
  gating,
  isAttestLoading,
  isAttesting,
  onSelfAttest,
  onRefresh,
  attestNote,
  attestTxHash,
  gatedAmountIn,
  onGatedAmountIn,
  gatedValid,
  isSimulatingGated,
  isGatedSwapping,
  onSimulate,
  onGatedSwap,
  gatedSimNote,
  gatedTxHash,
}) => {
  const gatedDisabled = isGatedExecuteDisabled({
    isSwapping: isGatedSwapping,
    connected: Boolean(connectedAddress),
    veilInValid: gatedValid,
    attested: attestation?.attested ?? null,
    isSimulating: isSimulatingGated,
  });
  const attestedDone = Boolean(connectedAddress) && attestation?.attested === true;

  return (
    <div
      role="region"
      aria-label="Self-attestation and gated pool"
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
        <span style={{ fontSize: "var(--text-caption)", fontWeight: 700, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Self-Attestation &amp; Gated Pool
        </span>
        <span style={{ fontSize: "11px", color: "var(--color-accent-ink)", fontFamily: "monospace", fontWeight: 600 }}>
          Testnet 46630
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "var(--text-caption)", fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
        Self-attestation is permissionless: anyone can attest, with no eligibility
        conditions (
        <a href="/docs/decisions" style={{ color: "var(--color-accent-ink)" }}>
          docs/DECISIONS.md
        </a>
        ; association-set policy:{" "}
        <a href="/docs/asp-policy" style={{ color: "var(--color-accent-ink)" }}>
          docs/ASP-POLICY.md
        </a>
        ).
        Pool gating is an anti-bot speedbump plus launch windows only — nothing
        claimed here beyond what the hook reports onchain below.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "var(--text-caption)", fontFamily: "monospace" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Registry:</span>
          <a href={`${GATED_EXPLORER_ADDRESS_BASE}${GATED_REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-ink)", overflowWrap: "anywhere" }}>
            {`${GATED_REGISTRY_ADDRESS.slice(0, 6)}…${GATED_REGISTRY_ADDRESS.slice(-4)}`}
          </a>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Hook:</span>
          <a href={`${GATED_EXPLORER_ADDRESS_BASE}${GATED_HOOK_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-ink)", overflowWrap: "anywhere" }}>
            {`${GATED_HOOK_ADDRESS.slice(0, 6)}…${GATED_HOOK_ADDRESS.slice(-4)}`}
          </a>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Your attestation:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right" }}>
            {!connectedAddress
              ? "Connect a wallet to read status"
              : isAttestLoading && attestation === null
              ? "Reading from chain…"
              : attestation?.attested
              ? "Attested — gated pool unlocked"
              : "Not attested — self-attest below"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <span style={{ color: "var(--color-muted)" }}>Pool gating:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600, textAlign: "right" }}>
            {!gating
              ? "Reading from chain…"
              : !gating.gated
              ? "Not gated — any address can swap"
              : gating.active
              ? `Active — temporary test window, ends ${gating.windowEndsAt !== null ? new Date(Number(gating.windowEndsAt) * 1000).toUTCString() : "never (permanent)"}`
              : "Window elapsed — pool currently accepts any address"}
          </span>
        </div>
        {gating?.gated && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <span style={{ color: "var(--color-muted)" }}>Gated pool:</span>
            <span style={{ color: "var(--color-muted)", textAlign: "right" }}>
              {`ETH/VEIL 0.3% · id ${GATED_POOL_ID.slice(0, 10)}… · window ${(Number(gating.duration) / 86400).toFixed(1)} days`}
            </span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onSelfAttest}
          disabled={isAttesting || attestedDone}
          aria-label="Self-attest the connected address onchain"
          style={{
            flex: 1,
            minHeight: "44px",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-accent)",
            color: "var(--color-accent-contrast)",
            fontWeight: 600,
            fontSize: "var(--text-body-sm)",
            cursor: isAttesting || attestedDone ? "not-allowed" : "pointer",
            opacity: isAttesting || attestedDone ? 0.45 : 1,
          }}
        >
          {!connectedAddress
            ? "Connect Wallet to Attest"
            : isAttesting
            ? "Attesting…"
            : attestation?.attested
            ? "Already Attested"
            : "Self-Attest (1 Transaction)"}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isAttestLoading || !connectedAddress}
          aria-label="Refresh attestation and gating status from chain"
          style={{
            minHeight: "44px",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            backgroundColor: "transparent",
            color: "var(--color-text)",
            fontWeight: 600,
            fontSize: "var(--text-body-sm)",
            cursor: isAttestLoading || !connectedAddress ? "not-allowed" : "pointer",
            opacity: isAttestLoading || !connectedAddress ? 0.45 : 1,
          }}
        >
          Refresh
        </button>
      </div>
      {attestNote && (
        <span role="status" style={{ color: "var(--color-accent-ink)", fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
          {attestNote}
        </span>
      )}
      {attestTxHash && (
        <span style={{ fontSize: "var(--text-caption)", fontFamily: "monospace", overflowWrap: "anywhere" }}>
          <span style={{ color: "var(--color-muted)" }}>Attestation tx: </span>
          <a href={`${GATED_EXPLORER_TX_BASE}${attestTxHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-ink)" }}>
            {attestTxHash}
          </a>
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
        <label htmlFor="gated-veil-amount" style={{ fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Gated Swap Amount (VEIL in, ETH out)
        </label>
        <input
          id="gated-veil-amount"
          type="text"
          inputMode="decimal"
          value={gatedAmountIn}
          onChange={(e) => onGatedAmountIn(e.target.value)}
          placeholder={PROVEN_GATED_VEIL_AMOUNT_IN}
          aria-describedby="gated-swap-hint"
          style={{
            minHeight: "44px",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text)",
            fontFamily: "monospace",
            fontSize: "16px",
          }}
        />
        <span id="gated-swap-hint" style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
          Minimum accepted is 1 wei, verbatim from the proven script — no slippage
          protection on this testnet path. Needs test VEIL already in your wallet;
          there is no onchain faucet.
        </span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSimulate}
            disabled={isSimulatingGated}
            aria-label="Simulate the gated swap gas-free via eth_call"
            style={{
              flex: 1,
              minHeight: "44px",
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              backgroundColor: "transparent",
              color: "var(--color-text)",
              fontWeight: 600,
              fontSize: "var(--text-body-sm)",
              cursor: isSimulatingGated ? "not-allowed" : "pointer",
              opacity: isSimulatingGated ? 0.45 : 1,
            }}
          >
            {isSimulatingGated ? "Simulating…" : "Simulate Gated Swap (Gas-Free)"}
          </button>
          <button
            type="button"
            onClick={onGatedSwap}
            disabled={gatedDisabled}
            aria-label="Execute the gated pool swap"
            style={{
              flex: 1,
              minHeight: "44px",
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: "var(--color-accent)",
              color: "var(--color-accent-contrast)",
              fontWeight: 600,
              fontSize: "var(--text-body-sm)",
              cursor: gatedDisabled ? "not-allowed" : "pointer",
              opacity: gatedDisabled ? 0.45 : 1,
            }}
          >
            {!connectedAddress
              ? "Connect Wallet to Trade"
              : !gatedValid
              ? "Enter VEIL Amount"
              : attestation?.attested !== true
              ? "Attest First to Unlock"
              : isGatedSwapping
              ? "Swapping Through Gated Pool…"
              : "Execute Gated Swap"}
          </button>
        </div>
        {gatedSimNote && (
          <span role="status" style={{ color: "var(--color-accent-ink)", fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
            {gatedSimNote}
          </span>
        )}
        {gatedTxHash && (
          <span style={{ fontSize: "var(--text-caption)", fontFamily: "monospace", overflowWrap: "anywhere" }}>
            <span style={{ color: "var(--color-muted)" }}>Gated swap tx: </span>
            <a href={`${GATED_EXPLORER_TX_BASE}${gatedTxHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent-ink)" }}>
              {gatedTxHash}
            </a>
          </span>
        )}
      </div>
    </div>
  );
};

export default AttestPanel;

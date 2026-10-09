"use client";

import React from "react";
import { formatEther } from "viem";
import { TESTNET_BOW_V3_VEIL_TOKEN } from "../../lib/privacy-pools";

export type BowDepositAsset = "ETH" | "VEIL";

export interface BuyAndShieldPanelProps {
  depositAsset: BowDepositAsset;
  onSelectDepositAsset: (asset: BowDepositAsset) => void;
  depositAmount: string;
  onDepositAmount: (v: string) => void;
  ethDenomination: bigint;
  veilMinimum: bigint | null;
  veilBalance: string | null;
  ethBalance: string;
  connectedAddress: string | null;
  isExecuting: boolean;
  amountValid: boolean;
  executeDisabled: boolean;
  onExecute: () => void;
}

/** Buy & Shield tab: 0xbow-only shield surface (native ETH + ERC20 VEIL). */
export const BuyAndShieldPanel: React.FC<BuyAndShieldPanelProps> = ({
  depositAsset,
  onSelectDepositAsset,
  depositAmount,
  onDepositAmount,
  ethDenomination,
  veilMinimum,
  veilBalance,
  ethBalance,
  connectedAddress,
  isExecuting,
  amountValid,
  executeDisabled,
  onExecute,
}) => {
  const isEth = depositAsset === "ETH";
  const denomLabel = isEth
    ? `${formatEther(ethDenomination)} ETH`
    : veilMinimum !== null
    ? `${formatEther(veilMinimum)} VEIL`
    : "…";
  const balanceLabel = isEth ? `${ethBalance} ETH` : `${veilBalance ?? "…"} VEIL`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Pay / Deposit Surface */}
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
            You Pay (Public Wallet)
          </span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
            Bal: {balanceLabel}
          </span>
        </div>

        {/* Amount Input & Asset Selector Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            aria-label={isEth ? "ETH amount to shield" : "VEIL amount to shield"}
            value={depositAmount}
            onChange={(e) => onDepositAmount(e.target.value)}
            placeholder="0.0"
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)",
              fontFamily: "var(--font-headline)",
              fontWeight: 600,
              color: "var(--color-text)",
              width: "60%",
              fontVariantNumeric: "tabular-nums",
            }}
          />

          {/* Shield-asset toggle: native test ETH or test VEIL.
              Direction drives the entrypoint deposit leg. */}
          <div
            role="group"
            aria-label="Shield asset: test ETH or test VEIL"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(255, 140, 0, 0.08)",
              border: "1px solid rgba(255, 140, 0, 0.3)",
              color: "var(--color-text)",
            }}
          >
            {(["VEIL", "ETH"] as const).map((sym) => {
              const active = depositAsset === sym;
              return (
                <button
                  key={sym}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Shield test ${sym}`}
                  onClick={() => onSelectDepositAsset(sym)}
                  style={{
                    padding: "6px 12px",
                    minHeight: "28px",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    border: active
                      ? "1px solid var(--color-accent)"
                      : "1px solid transparent",
                    backgroundColor: active ? "#ffffff" : "transparent",
                    color: active ? "var(--color-accent-ink)" : "var(--color-muted)",
                    transition: "all var(--duration-fast)",
                  }}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Receive / Shield Output Surface */}
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
            You Shield (0xbow Privacy Pool)
          </span>
          <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
            Fixed {denomLabel} / note
          </span>
        </div>

        <div
          style={{
            fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)",
            fontFamily: "var(--font-headline)",
            fontWeight: 600,
            color: "var(--color-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {denomLabel === "…" ? "Loading live VEIL minimum…" : denomLabel}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
          <span>
            {isEth
              ? "Entrypoint.deposit — native ETH to 0xbow ETH note"
              : "Entrypoint.deposit(asset, value, precommitment) — VEIL to 0xbow VEIL note"}
          </span>
          <span style={{ color: "var(--color-muted)", fontSize: "11px" }}>
            Groth16 Proof Payload
          </span>
        </div>
      </div>

      {/* Asset guidance */}
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
        <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)", lineHeight: 1.5, overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}>
          {isEth
            ? "Fund testnet ETH at the testnet faucet (https://faucet.testnet.chain.robinhood.com/) — gas plus shield input both need it."
            : `Needs test VEIL already in your wallet — there is no onchain faucet. Test VEIL: ${TESTNET_BOW_V3_VEIL_TOKEN}. VEIL deposits approve the entrypoint first; the app sends the approval in the same flow when allowance is short.`}
        </span>
      </div>

      {/* Main Action Button */}
      <button
        onClick={onExecute}
        disabled={executeDisabled}
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
          cursor: executeDisabled ? "not-allowed" : "pointer",
          opacity: executeDisabled ? 0.45 : 1,
          boxShadow: "0 6px 20px -2px rgba(255, 140, 0, 0.35)",
          transition: "all var(--duration-fast)",
        }}
      >
        <span>
          {isExecuting
            ? (isEth ? "Shielding ETH..." : "Approving & Shielding VEIL...")
            : !connectedAddress
            ? "Connect Wallet to Trade"
            : !amountValid
            ? `Enter ${depositAsset} Amount`
            : `Shield ${depositAsset} (0xbow)`}
        </span>
      </button>

      {/* Breakdown Details */}
      <div
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
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>You Pay:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            {depositAmount} {depositAsset}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>You Shield:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            fixed {denomLabel}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Proof System:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>Groth16 (0xbow v1.2.1)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Settlement:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>0xbow Entrypoint</span>
        </div>
      </div>
    </div>
  );
};

export default BuyAndShieldPanel;

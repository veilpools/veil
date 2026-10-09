"use client";

import React from "react";
import { formatEther } from "viem";
import { ArrowDown, ChevronDown } from "lucide-react";
import { ETH_ZERO_ADDRESS, formatNoteAmount } from "../../lib/note-format";
import { TESTNET_VEIL_TOKEN } from "../../lib/router-swap";
import { RouteInspector } from "../RouteInspector";
import type { TokenItem } from "../TokenSelectModal";

export interface RouterQuote {
  quotedOut: bigint;
  minAmountOut: bigint;
}

export interface BuyAndShieldPanelProps {
  isTestnetRouterMode: boolean;
  isEthRouterInput: boolean;
  routerPaySymbol: "VEIL" | "ETH";
  onSelectPayToken: (sym: "VEIL" | "ETH") => void;
  inputToken: TokenItem;
  outputToken: TokenItem;
  inputAmount: string;
  veilAmountIn: string;
  onInputAmount: (v: string) => void;
  onVeilAmountIn: (v: string) => void;
  veilBalance: string | null;
  onOpenInputTokenModal: () => void;
  onOpenOutputTokenModal: () => void;
  onPercentage: (pct: number) => void;
  onFlipTokens: () => void;
  liveDenomination: bigint | null;
  routerDestDenom: bigint | null;
  routerQuote: RouterQuote | null;
  routerQuoteNote: string | null;
  isQuoting: boolean;
  slippage: string;
  routerInputValid: boolean;
  routerQuoteBelowDenomination: boolean;
  parsedInput: number;
  inputMatchesDenomination: boolean;
  connectedAddress: string | null;
  isExecuting: boolean;
  executeDisabled: boolean;
  onExecute: () => void;
  forceDirect: boolean;
  onToggleForceDirect: () => void;
  isTestnetBuild: boolean;
}

/** Buy & Shield tab: pay surface, shield output, live quote, execute. */
export const BuyAndShieldPanel: React.FC<BuyAndShieldPanelProps> = ({
  isTestnetRouterMode,
  isEthRouterInput,
  routerPaySymbol,
  onSelectPayToken,
  inputToken,
  outputToken,
  inputAmount,
  veilAmountIn,
  onInputAmount,
  onVeilAmountIn,
  veilBalance,
  onOpenInputTokenModal,
  onOpenOutputTokenModal,
  onPercentage,
  onFlipTokens,
  liveDenomination,
  routerDestDenom,
  routerQuote,
  routerQuoteNote,
  isQuoting,
  slippage,
  routerInputValid,
  routerQuoteBelowDenomination,
  parsedInput,
  inputMatchesDenomination,
  connectedAddress,
  isExecuting,
  executeDisabled,
  onExecute,
  forceDirect,
  onToggleForceDirect,
  isTestnetBuild,
}) => {
  const paySymbol = isTestnetRouterMode ? routerPaySymbol : inputToken.symbol;
  const payAmount = isTestnetRouterMode
    ? isEthRouterInput
      ? inputAmount
      : veilAmountIn
    : inputAmount;
  const outAsset = isTestnetRouterMode && isEthRouterInput ? "VEIL" : "ETH";
  const outDenomLabel =
    isTestnetRouterMode && isEthRouterInput
      ? routerDestDenom !== null
        ? `${formatEther(routerDestDenom)} VEIL`
        : "…"
      : liveDenomination !== null
      ? formatNoteAmount(liveDenomination, ETH_ZERO_ADDRESS)
      : "…";

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
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
              Bal: {isTestnetRouterMode ? (isEthRouterInput ? `${inputToken.balance} ETH` : `${veilBalance ?? "…"} VEIL`) : `${inputToken.balance} ${inputToken.symbol}`}
            </span>
            {!isTestnetRouterMode && (
            <div style={{ display: "flex", gap: "4px" }}>
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onPercentage(pct)}
                  aria-label={`Set amount to ${pct === 1 ? "max" : `${pct * 100} percent`} of balance`}
                  className="hover:border-[#FF8C00] hover:text-[#FF8C00] active:scale-95 transition-all"
                  style={{
                    padding: "4px 8px",
                    minHeight: "24px",
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border-strong)",
                    color: "var(--color-text)",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: 600,
                    boxShadow: "0 1px 2px rgba(26, 26, 26, 0.04)",
                  }}
                >
                  {pct === 1.0 ? "MAX" : `${pct * 100}%`}
                </button>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Amount Input & Token Selector Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            aria-label={isTestnetRouterMode ? (isEthRouterInput ? "ETH amount to swap and shield" : "VEIL amount to swap and shield") : "Amount to pay"}
            value={payAmount}
            onChange={(e) => (isTestnetRouterMode ? (isEthRouterInput ? onInputAmount(e.target.value) : onVeilAmountIn(e.target.value)) : onInputAmount(e.target.value))}
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

          {/* Pay-token toggle (R3): ETH (faucet-funded) or test VEIL
              (pre-held, no faucet). Direction drives quote and value. */}
          {isTestnetRouterMode ? (
            <div
              role="group"
              aria-label="Router pay token: test VEIL or test ETH"
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
                const active = routerPaySymbol === sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Pay with test ${sym}`}
                    onClick={() => onSelectPayToken(sym)}
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
          ) : (
          <button
            onClick={onOpenInputTokenModal}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text)",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(26, 26, 26, 0.06)",
              transition: "all var(--duration-fast)",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              {inputToken.iconSvg}
            </div>
            <span style={{ fontWeight: 600, fontFamily: "var(--font-body)", fontSize: "var(--text-body)" }}>
              {inputToken.symbol}
            </span>
            <ChevronDown className="w-4 h-4 text-[#FF8C00]" aria-hidden="true" />
          </button>
          )}
        </div>
      </div>

      {/* Swap Direction Divider with Flip Action (hidden on the testnet router route) */}
      <div style={{ display: isTestnetRouterMode ? "none" : "flex", justifyContent: "center", margin: "-10px 0", position: "relative", zIndex: 10 }}>
        <button
          type="button"
          onClick={onFlipTokens}
          title="Flip token direction"
          className="hover:scale-110 hover:border-[#FF8C00] active:rotate-180 transition-all duration-300"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "var(--radius-full)",
            backgroundColor: "#ffffff",
            border: "1px solid var(--color-border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-accent-ink)",
            boxShadow: "0 4px 12px rgba(26, 26, 26, 0.1)",
            cursor: "pointer",
          }}
        >
          <ArrowDown className="w-4 h-4" aria-hidden="true" />
        </button>
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
            You Shield (LeanIMT Pool)
          </span>
          <span style={{ fontSize: "11px", color: "var(--color-muted)", fontFamily: "monospace" }}>
            Fixed {outDenomLabel} / note
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)",
              fontFamily: "var(--font-headline)",
              fontWeight: 600,
              color: "var(--color-text)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {outDenomLabel === "…" ? "Loading live denomination…" : outDenomLabel}
          </div>

          {/* Token Button: fixed by route direction in router mode (the
              destination pool follows pay direction, chosen live) */}
          <button
            onClick={onOpenOutputTokenModal}
            disabled={isTestnetRouterMode}
            title={
              isTestnetRouterMode
                ? `Destination fixed by direction: ${isEthRouterInput ? "VEIL pool (live-picked)" : "0.001 ETH pool"}`
                : "Choose shield pool token"
            }
            aria-disabled={isTestnetRouterMode}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border-strong)",
              color: "var(--color-text)",
              cursor: isTestnetRouterMode ? "not-allowed" : "pointer",
              opacity: isTestnetRouterMode ? 0.6 : 1,
              boxShadow: "0 2px 6px rgba(26, 26, 26, 0.06)",
              transition: "all var(--duration-fast)",
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              {outputToken.iconSvg}
            </div>
            <span style={{ fontWeight: 600, fontFamily: "var(--font-body)", fontSize: "var(--text-body)" }}>
              {isTestnetRouterMode ? (isEthRouterInput ? "VEIL" : "ETH") : outputToken.symbol}
            </span>
            <ChevronDown className="w-4 h-4 text-[#FF8C00]" aria-hidden="true" />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-caption)", color: "var(--color-muted)", fontFamily: "monospace" }}>
          <span>
            {isTestnetRouterMode
              ? (isEthRouterInput
                ? "VeilShieldRouter.swapToShield — ETH to VEIL note (live simulation quote)"
                : "VeilShieldRouter.swapToShield — VEIL to ETH to 0.001 ETH note (live simulation quote)")
              : "Direct ShieldedPool deposit — no swap route yet"}
          </span>
          <span style={{ color: "var(--color-muted)", fontSize: "11px" }}>
            {isTestnetBuild && forceDirect ? "Groth16 Proof Payload" : "Legacy Mock Proof Payload (old notes)"}
          </span>
        </div>
      </div>

      {/* Route Inspector */}
      <RouteInspector
        inputAmount={payAmount}
        inputToken={isTestnetRouterMode ? paySymbol : inputToken.symbol}
        outputToken={outputToken.symbol}
        slippage={slippage}
      />

      {/* Testnet router live quote + faucet guidance (R1/R3) */}
      {isTestnetRouterMode && (
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
            <span style={{ color: "var(--color-muted)" }}>Live simulated output:</span>
            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {isQuoting
                ? "Simulating…"
                : routerQuote !== null
                ? `${formatEther(routerQuote.quotedOut)} ${outAsset}`
                : "Unavailable"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-muted)" }}>Minimum accepted ({slippage}%):</span>
            <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
              {routerQuote !== null ? `${formatEther(routerQuote.minAmountOut)} ${outAsset}` : "—"}
            </span>
          </div>
          {routerQuoteNote && (
            <span style={{ color: "var(--color-accent-ink)", fontFamily: "var(--font-body)", lineHeight: 1.5, overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}>
              {routerQuoteNote}
            </span>
          )}
          <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)", lineHeight: 1.5, overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 }}>
            {isEthRouterInput
              ? "Fund testnet ETH at the testnet faucet (https://faucet.testnet.chain.robinhood.com/) — gas plus swap input both need it."
              : `Needs test VEIL already in your wallet — there is no onchain faucet; the proven route ran on a pre-funded operator balance. Test VEIL: ${TESTNET_VEIL_TOKEN}.`}
          </span>
        </div>
      )}

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
          {isTestnetRouterMode
            ? isExecuting
              ? (isEthRouterInput ? "Swapping ETH to Shielded VEIL..." : "Swapping VEIL to Shielded ETH...")
              : !connectedAddress
              ? "Connect Wallet to Trade"
              : !routerInputValid
              ? `Enter ${paySymbol} Amount`
              : routerQuoteBelowDenomination
              ? "Output Below Note Size"
              : isQuoting || routerQuote === null
              ? "Simulating Live Output…"
              : "Execute Router Swap-to-Shield"
            : isExecuting
            ? "Synthesizing Proof & Routing..."
            : !connectedAddress
            ? "Connect Wallet to Trade"
            : !inputAmount || parsedInput <= 0
            ? "Enter Amount"
            : !inputMatchesDenomination
            ? "Enter Exact Denomination"
            : "Execute 1-Tx Swap-to-Shield"}
        </span>
      </button>

      {/* Quote Breakdown Details */}
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
            {isTestnetRouterMode ? `${payAmount} ${paySymbol}` : `${inputAmount} ${inputToken.symbol}`}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>You Shield:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>
            fixed {outDenomLabel}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Slippage:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{slippage}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>VeilHook Protocol Fee:</span>
          <span style={{ color: "var(--color-accent-ink)", fontWeight: 600 }}>30 bps (Buyback &amp; Burn)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-muted)" }}>Zero-Custody Guarantee:</span>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>Router Balance = 0 Invariant</span>
        </div>
      </div>

      {/* Honest fallback toggle (testnet only): direct pool deposit
          without the swap route, for use only when the router
          route is unavailable. The router stays the default path. */}
      {isTestnetBuild && (
        <button
          type="button"
          onClick={onToggleForceDirect}
          aria-pressed={forceDirect}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            minHeight: "24px",
            fontSize: "var(--text-caption)",
            fontFamily: "monospace",
            color: "var(--color-muted)",
            textDecoration: "underline",
            textAlign: "center",
          }}
        >
          {forceDirect
            ? "Fallback active: direct ShieldedPool deposit (no swap). Switch back to the router route."
            : "Router route unavailable? Fall back to direct ShieldedPool deposit (no swap)."}
        </button>
      )}
    </div>
  );
};

export default BuyAndShieldPanel;

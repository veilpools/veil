"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { publicClient } from "@/lib/balances";
import { formatEther } from "viem";

interface RouteInspectorProps {
  inputAmount: string;
  inputToken: string;
  outputToken: string;
  slippage: string;
}

export const RouteInspector: React.FC<RouteInspectorProps> = ({
  inputToken,
  slippage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [routerBalance, setRouterBalance] = useState<string | null>(null);

  const hookAddress = CONTRACT_ADDRESSES.hook as string;
  const hookShort = `${hookAddress.slice(0, 6)}…${hookAddress.slice(-4)}`;

  // Live zero-custody invariant: read router ETH balance only when expanded.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const bal = await publicClient.getBalance({
          address: CONTRACT_ADDRESSES.router as `0x${string}`,
        });
        if (!cancelled) setRouterBalance(formatEther(bal));
      } catch {
        if (!cancelled) setRouterBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        backgroundColor: "rgba(26, 26, 26, 0.025)",
        overflow: "hidden",
        fontSize: "var(--text-caption)",
        transition: "all var(--duration-fast)",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="route-inspector-panel"
        aria-label={`Execution route and invariants, ${isOpen ? "collapse" : "expand"}`}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "var(--color-text)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600, color: "var(--color-text)", fontSize: "12px" }}>
            Execution Route &amp; Invariants
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "monospace", color: "var(--color-accent-ink)", fontWeight: 600, fontSize: "11px" }}>
            Uniswap v4 ➔ LeanIMT
          </span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
        </div>
      </button>

      {isOpen && (
        <div id="route-inspector-panel" style={{ padding: "0 14px 14px 14px", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Visual Node Chain */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", overflowX: "auto", padding: "8px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <div style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", backgroundColor: "#ffffff", border: "1px solid var(--color-border-strong)", fontFamily: "monospace", fontSize: "11px", color: "var(--color-text)", fontWeight: 600, boxShadow: "0 1px 3px rgba(26, 26, 26, 0.05)" }}>
                {inputToken}
              </div>
              <span style={{ fontSize: "10px", color: "var(--color-muted)" }}>Wallet</span>
            </div>

            <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <div style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(255, 140, 0, 0.08)", border: "1px solid rgba(255, 140, 0, 0.25)", fontFamily: "monospace", fontSize: "11px", color: "var(--color-accent-ink)", fontWeight: 600 }} title={hookAddress}>
                VeilHook {hookShort}
              </div>
              <span style={{ fontSize: "10px", color: "var(--color-accent-ink)" }}>beforeSwap Gate</span>
            </div>

            <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <div style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", backgroundColor: "#ffffff", border: "1px solid var(--color-border-strong)", fontFamily: "monospace", fontSize: "11px", color: "var(--color-text)", fontWeight: 600, boxShadow: "0 1px 3px rgba(26, 26, 26, 0.05)" }}>
                PoolManager
              </div>
              <span style={{ fontSize: "10px", color: "var(--color-muted)" }}>v4 Core Swap</span>
            </div>

            <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              <div style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(255, 140, 0, 0.08)", border: "1px solid rgba(255, 140, 0, 0.25)", fontFamily: "monospace", fontSize: "11px", color: "var(--color-accent-ink)", fontWeight: 600 }}>
                ShieldedPool
              </div>
              <span style={{ fontSize: "10px", color: "var(--color-accent-ink)" }}>LeanIMT Tree</span>
            </div>
          </div>

          {/* Invariant Checklist */}
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontFamily: "monospace",
              fontSize: "11px",
              color: "var(--color-text)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-muted)" }}>Zero-Custody Router Balance:</span>
              <span style={{ color: "var(--color-accent-ink)", fontWeight: 600 }}>
                {routerBalance === null ? "Reading…" : `${Number(routerBalance).toFixed(3)} ETH${Number(routerBalance) === 0 ? " (Verified Invariant)" : " (Live)"}`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-muted)" }}>Max Allowable Slippage:</span>
              <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{slippage}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-muted)" }}>Protocol Fee (VeilTreasury):</span>
              <span style={{ color: "var(--color-accent-ink)", fontWeight: 600 }}>30 bps</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: "10px", fontFamily: "var(--font-body)", color: "var(--color-muted)", lineHeight: 1.5 }}>
            Planned route shown. Direct v1 pool deposits settle straight into the ShieldedPool and bypass the hook/swap path above.
          </p>
        </div>
      )}
    </div>
  );
};

export default RouteInspector;

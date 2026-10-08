"use client";

import React from "react";
import { SectionHeader } from "./SectionHeader";

interface ComparisonRow {
  metric: string;
  publicPool: string;
  veil: string;
}

const rows: ComparisonRow[] = [
  {
    metric: "Mempool exposure",
    publicPool: "100% visible to bots & searchers",
    veil: "Zero (encrypted notes)",
  },
  {
    metric: "MEV vulnerability",
    publicPool: "Guaranteed sandwich on size trades",
    veil: "Eliminated by design",
  },
  {
    metric: "Liquidity depth",
    publicPool: "Standard Uniswap pools",
    veil: "Identical (v4 hook routing)",
  },
  {
    metric: "Wallet linkability",
    publicPool: "Permanent on public explorer",
    veil: "Zero link via relayers",
  },
  {
    metric: "Asset custody",
    publicPool: "Standard smart contract custody",
    veil: "0 held balance (LeanIMT invariant)",
  },
  {
    metric: "Sanctions contagion",
    publicPool: "Exposed to tainted counterparties",
    veil: "0% (Attested clean ASP roots)",
  },
];

export const ComparisonSection: React.FC = () => {
  return (
    <section id="why-veil" style={{ padding: "var(--section-y) var(--page-gutter)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {/* Section Header */}
        <SectionHeader
          kicker="Architecture Comparison"
          title="An execution layer, not a mixer."
          sub="Underneath the interface is a zero-knowledge Uniswap v4 routing hook, not an anonymity mixer. Swaps settle atomically with zero protocol custody and per-transaction slippage bounds."
          titleMaxW="26ch"
          kickerColor="#FF8C00"
        />

        {/* Visual Pipeline Comparison: The Status Quo vs The Veil Solution */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "var(--space-6)",
            alignItems: "stretch",
          }}
        >
          {/* Card A: The Status Quo */}
          <div
            className="lp-card"
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(185, 28, 28, 0.22)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "var(--space-5)",
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--color-hairline)",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-muted)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    PUBLIC_ROUTING // MEMPOOL
                  </span>
                </div>

                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(185, 28, 28, 0.08)",
                    border: "1px solid rgba(185, 28, 28, 0.2)",
                    color: "#b91c1c",
                  }}
                >
                  Mempool Exposed
                </span>
              </div>

              {/* Title & Desc */}
              <div style={{ marginTop: "var(--space-4)" }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-headline)",
                    fontSize: "var(--text-h3)",
                    lineHeight: 1.2,
                    color: "var(--color-text)",
                  }}
                >
                  Public Mempool Routing
                </h3>
                <p
                  style={{
                    margin: "var(--space-2) 0 0",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-muted)",
                    lineHeight: "var(--leading-body-sm)",
                  }}
                >
                  Unencrypted transactions broadcast your wallet, trade intent, and alpha to MEV searcher bots and copy-traders.
                </p>
              </div>

              {/* Clean Structured Pipeline Nodes */}
              <div
                style={{
                  marginTop: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  background: "var(--color-panel)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-hairline)",
                  padding: "var(--space-4)",
                }}
              >
                {/* Node 1 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(185, 28, 28, 0.1)",
                      border: "1px solid rgba(185, 28, 28, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "#b91c1c",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    1
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      Trader (0x7099...a192)
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      Public EOA Wallet Signer
                    </div>
                  </div>
                </div>

                {/* Connector 1 */}
                <div style={{ display: "flex", alignItems: "center", margin: "6px 0 6px 10px" }}>
                  <div style={{ width: 2, height: 32, background: "rgba(185, 28, 28, 0.2)", marginRight: "var(--space-3)" }} />
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(185, 28, 28, 0.08)",
                      color: "#b91c1c",
                      fontWeight: 600,
                    }}
                  >
                    Exposed to Sandwich Bots (-$1,420 MEV)
                  </span>
                </div>

                {/* Node 2 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(185, 28, 28, 0.1)",
                      border: "1px solid rgba(185, 28, 28, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "#b91c1c",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    2
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      Public AMM Pool
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      Broadcast Orderflow &amp; Slippage
                    </div>
                  </div>
                </div>

                {/* Connector 2 */}
                <div style={{ display: "flex", alignItems: "center", margin: "6px 0 6px 10px" }}>
                  <div style={{ width: 2, height: 32, background: "rgba(185, 28, 28, 0.2)", marginRight: "var(--space-3)" }} />
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(185, 28, 28, 0.08)",
                      color: "#b91c1c",
                      fontWeight: 600,
                    }}
                  >
                    Permanently Indexed on Blockscout
                  </span>
                </div>

                {/* Node 3 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(185, 28, 28, 0.1)",
                      border: "1px solid rgba(185, 28, 28, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "#b91c1c",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    3
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "#b91c1c" }}>
                      Linked Recipient (0x3C44...e810)
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      100% Traceable Counterparty Link
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Tag */}
            <div
              style={{
                borderTop: "1px dashed var(--color-hairline)",
                paddingTop: "var(--space-3)",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "#b91c1c",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "13px" }}>●</span>
              <span>Vulnerability: Public wallet linkability &amp; alpha drainage</span>
            </div>
          </div>

          {/* Card B: The Veil Solution */}
          <div
            className="lp-card"
            style={{
              background: "var(--color-panel)",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--color-accent)",
              boxShadow: "0 4px 24px rgba(255, 140, 0, 0.1)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "var(--space-5)",
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--color-hairline)",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent)", display: "inline-block" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent)", display: "inline-block" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent)", display: "inline-block" }} />
                  </div>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    VEIL_DARK_ROUTER // ZK_ATOMIC
                  </span>
                </div>

                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255, 140, 0, 0.12)",
                    border: "1px solid rgba(255, 140, 0, 0.3)",
                    color: "var(--color-accent)",
                  }}
                >
                  0-Held Invariant
                </span>
              </div>

              {/* Title & Desc */}
              <div style={{ marginTop: "var(--space-4)" }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-headline)",
                    fontSize: "var(--text-h3)",
                    lineHeight: 1.2,
                    color: "var(--color-text)",
                  }}
                >
                  Veil Zero-Trace Execution
                </h3>
                <p
                  style={{
                    margin: "var(--space-2) 0 0",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-muted)",
                    lineHeight: "var(--leading-body-sm)",
                  }}
                >
                  Orders settle atomically inside Uniswap v4 pools via beforeSwap hooks with zero protocol custody and zero link to deposit.
                </p>
              </div>

              {/* Clean Structured Pipeline Nodes */}
              <div
                style={{
                  marginTop: "var(--space-5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-hairline)",
                  padding: "var(--space-4)",
                }}
              >
                {/* Node 1 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(255, 140, 0, 0.15)",
                      border: "1px solid var(--color-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "var(--color-accent)",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    1
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      Shielded Note (Merkle 2²⁰)
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      Client-Side Proof Payload
                    </div>
                  </div>
                </div>

                {/* Connector 1 */}
                <div style={{ display: "flex", alignItems: "center", margin: "6px 0 6px 10px" }}>
                  <div style={{ width: 2, height: 32, background: "var(--color-accent)", opacity: 0.6, marginRight: "var(--space-3)" }} />
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255, 140, 0, 0.1)",
                      color: "var(--color-accent)",
                      fontWeight: 600,
                    }}
                  >
                    beforeSwap ZK Hook Gate (0 MEV Vulnerability)
                  </span>
                </div>

                {/* Node 2 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(255, 140, 0, 0.15)",
                      border: "1px solid var(--color-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "var(--color-accent)",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    2
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
                      Uniswap v4 PoolManager (0x20c4)
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      0-Held Balance Invariant · Atomic Settlement
                    </div>
                  </div>
                </div>

                {/* Connector 2 */}
                <div style={{ display: "flex", alignItems: "center", margin: "6px 0 6px 10px" }}>
                  <div style={{ width: 2, height: 32, background: "var(--color-accent)", opacity: 0.6, marginRight: "var(--space-3)" }} />
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255, 140, 0, 0.1)",
                      color: "var(--color-accent)",
                      fontWeight: 600,
                    }}
                  >
                    Gasless Unlinked Relayer Dispatch
                  </span>
                </div>

                {/* Node 3 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "rgba(255, 140, 0, 0.15)",
                      border: "1px solid var(--color-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "var(--color-accent)",
                      flexShrink: 0,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    3
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 700, color: "var(--color-accent)" }}>
                      Fresh Recipient (0x9b42...120f)
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--color-muted)" }}>
                      Zero On-Chain Link to Origin Deposit
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Tag */}
            <div
              style={{
                borderTop: "1px dashed var(--color-hairline)",
                paddingTop: "var(--space-3)",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--color-accent)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "13px" }}>●</span>
              <span>The trade executes on-chain. The trader remains invisible.</span>
            </div>
          </div>
        </div>

        {/* Detailed Comparison Table & Action Area */}
        <div className="comparison-grid" style={{ marginTop: "var(--space-4)" }}>
          {/* Left Column: CTAs and Summary */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--color-faint)",
                  fontWeight: 600,
                }}
              >
                Institutional Standard
              </span>
              <h4
                style={{
                  margin: 0,
                  fontFamily: "var(--font-headline)",
                  fontSize: "var(--text-h3)",
                  color: "var(--color-text)",
                  lineHeight: 1.2,
                }}
              >
                Eliminate information leakage without leaving DEX liquidity.
              </h4>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  color: "var(--color-muted)",
                  lineHeight: "var(--leading-body-sm)",
                }}
              >
                No split liquidity pools, no centralized bridges, and no custody risk. Veil taps Uniswap v4 canonical liquidity directly while keeping your balances shielded.
              </p>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
              <a
                href="/trade"
                className="lp-btn lp-btn--accent"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-lg)",
                  lineHeight: 1,
                  letterSpacing: "0.005em",
                  textDecoration: "none",
                  cursor: "pointer",
                  minHeight: "3rem",
                  padding: "0 var(--space-5)",
                  borderRadius: "var(--radius-md)",
                  border: "var(--border-thin) solid transparent",
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                  background: "var(--color-accent)",
                  color: "var(--color-accent-contrast)",
                }}
              >
                Launch App
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M1 6H10.4M6.2 1.8L10.4 6L6.2 10.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </a>

              <a
                href="/contracts"
                className="lp-btn lp-btn--outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-lg)",
                  lineHeight: 1,
                  letterSpacing: "0.005em",
                  textDecoration: "none",
                  cursor: "pointer",
                  minHeight: "3rem",
                  padding: "0 var(--space-5)",
                  borderRadius: "var(--radius-md)",
                  border: "var(--border-thin) solid var(--color-border-strong)",
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                  background: "transparent",
                  color: "var(--color-text)",
                }}
              >
                View Contracts
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M1 6H10.4M6.2 1.8L10.4 6L6.2 10.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Right Column: Clean Comparison Table */}
          <div style={{ minWidth: 0 }}>
            <div
              className="lp-card comparison-table-scroll"
              style={{
                background: "var(--color-panel)",
                color: "var(--color-text)",
                borderRadius: "var(--radius-lg)",
                padding: 0,
                border: "var(--border-thin) solid var(--color-border)",
              }}
            >
              <div className="comparison-table-inner">
                {/* Table Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.3fr 1.1fr 1.1fr",
                    gap: "var(--space-4)",
                    padding: "var(--space-4) var(--space-6)",
                    borderBottom: "var(--border-thin) solid var(--color-border-strong)",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-caption)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-muted)",
                  }}
                >
                  <div>Metric</div>
                  <div>Public Uniswap v4</div>
                  <div style={{ color: "var(--color-accent)", fontWeight: 700 }}>Veil Protocol</div>
                </div>

                {/* Table Rows */}
                <div>
                  {rows.map((row, i) => (
                    <div
                      key={row.metric}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.3fr 1.1fr 1.1fr",
                        gap: "var(--space-4)",
                        padding: "var(--space-5) var(--space-6)",
                        borderBottom:
                          i === rows.length - 1
                            ? "none"
                            : "var(--border-thin) solid var(--color-border)",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-headline)",
                          fontSize: "var(--text-h4)",
                          lineHeight: 1.15,
                          color: "var(--color-text)",
                        }}
                      >
                        {row.metric}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--text-body-sm)",
                          lineHeight: "var(--leading-body-sm)",
                          color: "var(--color-muted)",
                        }}
                      >
                        {row.publicPool}
                      </div>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "var(--text-body-sm)",
                          lineHeight: "var(--leading-body-sm)",
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        {row.veil}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ComparisonSection;

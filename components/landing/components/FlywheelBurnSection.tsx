"use client";

import React, { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { RevealBox } from "./RevealBox";
import { CountUp } from "./CountUp";

interface BurnEvent {
  txHash: string;
  amount: string;
  source: "VeilHook Protocol Fee" | "Pons Creator Fee";
  timestamp: string;
  blockNumber: number;
}

export const FlywheelBurnSection: React.FC = () => {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const totalBurned = "12,450,000 VEIL";
  const totalBuybackEth = "3.42 ETH";
  const currentTreasuryBalance = "0.85 ETH";

  const burnHistory: BurnEvent[] = [
    {
      txHash: "0x2e2b78ee1f88027a74bfcd6243b5282b6670e77a0f0754f1f715fa3033ea7e7f",
      amount: "2,500,000 VEIL",
      source: "VeilHook Protocol Fee",
      timestamp: "2026-10-04 18:24 UTC",
      blockNumber: 74493182,
    },
    {
      txHash: "0xdd8d74717fb0b0cedd3d72d9dad001337c1220858732eacc76cdd45bf7986537",
      amount: "4,100,000 VEIL",
      source: "Pons Creator Fee",
      timestamp: "2026-10-03 14:10 UTC",
      blockNumber: 74492346,
    },
    {
      txHash: "0xe1d56d831c4ea6305d1c47c5298fce39f335e50954b8086e03b2764609d94c50",
      amount: "5,850,000 VEIL",
      source: "VeilHook Protocol Fee",
      timestamp: "2026-10-02 09:45 UTC",
      blockNumber: 74484139,
    },
  ];

  const copyToClipboard = (tx: string) => {
    navigator.clipboard.writeText(tx);
    setCopiedTx(tx);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  return (
    <section id="flywheel" style={{ padding: "var(--section-y) var(--page-gutter)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {/* Section Header */}
        <SectionHeader
          kicker="Protocol Flywheel"
          title="Autonomous burn ledger. Deflationary by code."
          sub="All burns execute on-chain via the native burn() call, permanently reducing total supply. Programmatically funded by Uniswap v4 hook swap fees and creator royalties."
          titleMaxW="26ch"
          kickerColor="#FF8C00"
        />

        {/* KPI Metrics Cards */}
        <RevealBox
          stagger={80}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          <div
            className="lp-card"
            style={{
              background: "var(--color-panel)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-faint)",
              }}
            >
              Total Tokens Burned
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h2)",
                color: "var(--color-text)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              <CountUp value={totalBurned} />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-accent)",
                fontWeight: 600,
              }}
            >
              Permanent Supply Reduction
            </span>
          </div>

          <div
            className="lp-card"
            style={{
              background: "var(--color-panel)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-faint)",
              }}
            >
              Cumulative Buyback Volume
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h2)",
                color: "var(--color-text)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              <CountUp value={totalBuybackEth} />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              Executed via Uniswap v4 Hook Fees
            </span>
          </div>

          <div
            className="lp-card"
            style={{
              background: "var(--color-panel)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--color-faint)",
              }}
            >
              Treasury Pending Buyback
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h2)",
                color: "var(--color-text)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              <CountUp value={currentTreasuryBalance} />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              Accumulating for Next Epoch
            </span>
          </div>
        </RevealBox>

        {/* Dual-Source Revenue Obsidian Banner */}
        <RevealBox>
          <div
            className="lp-card"
            style={{
              padding: "var(--space-8)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-5)",
              background: "var(--color-white)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-hairline)",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-caption)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "var(--color-accent)",
                  fontWeight: 600,
                }}
              >
                Dual-Source Revenue Model
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-caption)",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-panel-chip)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-hairline)",
                  fontWeight: 600,
                }}
              >
                Zero Speculation Reliance
              </span>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 var(--space-2) 0",
                  fontFamily: "var(--font-headline)",
                  fontSize: "var(--text-h3)",
                  color: "var(--color-text)",
                  fontWeight: 600,
                }}
              >
                Product Utility &amp; Creator Liquidity Flywheel
              </h3>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  lineHeight: "var(--leading-body)",
                  color: "var(--color-muted)",
                  maxWidth: "68ch",
                }}
              >
                Unlike inflationary reward systems, Veil extracts real yield directly from DEX volume and creator activity, feeding programmatic market purchases and permanent token removal.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "var(--space-4)",
                marginTop: "var(--space-2)",
              }}
            >
              <div
                style={{
                  padding: "var(--space-5)",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-hairline)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "var(--color-accent)",
                      background: "rgba(255, 140, 0, 0.12)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    <CountUp value="30" /> BPS
                  </span>
                  <span style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
                    VeilHook Protocol Fee
                  </span>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-muted)", lineHeight: "var(--leading-body-sm)" }}>
                  Collected on all swaps passing through ZK-gated hooks and Swap-to-Shield router. Accumulates autonomously in VeilTreasury for automated execution.
                </p>
              </div>

              <div
                style={{
                  padding: "var(--space-5)",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-hairline)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "var(--color-accent)",
                      background: "rgba(255, 140, 0, 0.12)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    ROYALTIES
                  </span>
                  <span style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h4)", color: "var(--color-text)", fontWeight: 600 }}>
                    Pons Creator Fee
                  </span>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-muted)", lineHeight: "var(--leading-body-sm)" }}>
                  Creator royalties from the official Pons token launch programmatically routed to VeilTreasury for systematic market buybacks and burns.
                </p>
              </div>
            </div>
          </div>
        </RevealBox>

        {/* Burn Proof Events History Table */}
        <RevealBox>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <h3
                  style={{
                    margin: "0 0 var(--space-1) 0",
                    fontFamily: "var(--font-headline)",
                    fontSize: "var(--text-h3)",
                    color: "var(--color-text)",
                  }}
                >
                  On-Chain Burn Proof Events
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-muted)",
                  }}
                >
                  Real-time transaction receipts verifiable on the Robinhood Chain block explorer.
                </span>
              </div>
            </div>

            <div
              className="lp-card"
              style={{
                background: "var(--color-panel)",
                borderRadius: "var(--radius-lg)",
                padding: 0,
                overflow: "hidden",
                border: "var(--border-thin) solid var(--color-border)",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: "680px" }}>
                  {/* Table Header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.8fr 1.2fr 1.4fr 1fr 1fr",
                      gap: "var(--space-4)",
                      padding: "var(--space-4) var(--space-6)",
                      borderBottom: "var(--border-thin) solid var(--color-border-strong)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--color-faint)",
                      fontWeight: 600,
                    }}
                  >
                    <span>Transaction Hash</span>
                    <span>Amount Burned</span>
                    <span>Source</span>
                    <span>Timestamp</span>
                    <span style={{ textAlign: "right" }}>Explorer</span>
                  </div>

                  {/* Table Rows */}
                  {burnHistory.map((event, idx) => (
                    <div
                      key={event.txHash}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.8fr 1.2fr 1.4fr 1fr 1fr",
                        gap: "var(--space-4)",
                        padding: "var(--space-4) var(--space-6)",
                        borderBottom:
                          idx === burnHistory.length - 1
                            ? "none"
                            : "var(--border-thin) solid var(--color-border)",
                        alignItems: "center",
                        fontSize: "var(--text-body-sm)",
                      }}
                    >
                      {/* Tx Hash */}
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            color: "var(--color-text)",
                            fontWeight: 500,
                          }}
                        >
                          {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(event.txHash)}
                          title="Copy Transaction Hash"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            fontFamily: "monospace",
                            fontSize: "11px",
                            color: copiedTx === event.txHash ? "var(--color-accent)" : "var(--color-faint)",
                            transition: "color 0.15s ease",
                          }}
                        >
                          {copiedTx === event.txHash ? "Copied" : "Copy"}
                        </button>
                      </div>

                      {/* Amount */}
                      <span
                        style={{
                          fontFamily: "monospace",
                          color: "var(--color-accent)",
                          fontWeight: 700,
                        }}
                      >
                        <CountUp value={event.amount} />
                      </span>

                      {/* Source */}
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          color: "var(--color-muted)",
                        }}
                      >
                        {event.source}
                      </span>

                      {/* Timestamp */}
                      <span
                        style={{
                          fontFamily: "monospace",
                          color: "var(--color-faint)",
                          fontSize: "var(--text-caption)",
                        }}
                      >
                        {event.timestamp}
                      </span>

                      {/* Explorer Link */}
                      <div style={{ textAlign: "right" }}>
                        <a
                          href={`https://explorer.mainnet.chain.robinhood.com/tx/${event.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--text-caption)",
                            color: "var(--color-accent)",
                            textDecoration: "none",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          Verify
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M1 6H10.4M6.2 1.8L10.4 6L6.2 10.2" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </RevealBox>
      </div>
    </section>
  );
};

export default FlywheelBurnSection;

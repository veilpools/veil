"use client";

import React, { useEffect, useState } from "react";
import { formatEther, parseAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@/lib/contracts";
import { SectionHeader } from "./SectionHeader";
import { RevealBox } from "./RevealBox";
import { CountUp } from "./CountUp";

const TREASURY_ADDRESS = (CONTRACT_ADDRESSES.treasury ||
  "0x1b631ab61b99b364e3a880bd43adfe1b665bce16") as Address;
const HOOK_ADDRESS = (CONTRACT_ADDRESSES.hook ||
  "0x5b2e52fe4f54327d8272327d12e47cba834360c4") as Address;
const EXPLORER = "https://explorer.mainnet.chain.robinhood.com";

// Event name verified in lib/veil-artifact.ts VEIL_TREASURY_ABI — never invented.
const TOKENS_BURNED_EVENT = parseAbiItem(
  "event TokensBurned(uint256 amount, uint256 totalBurnedCumulative)"
);

interface BurnEvent {
  txHash: string;
  amount: string;
  source: "VeilTreasury burn";
  timestamp: string;
  blockNumber: number;
}

function formatVeil(raw: bigint): string {
  const n = Number(formatEther(raw));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} VEIL`;
}

function formatEth(raw: bigint): string {
  const n = Number(formatEther(raw));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`;
}

export const FlywheelBurnSection: React.FC = () => {
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [totalBurned, setTotalBurned] = useState<string | null>(null);
  const [totalFeeVolume, setTotalFeeVolume] = useState<string | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<string | null>(null);
  const [feeBps, setFeeBps] = useState<bigint | null>(null);
  const [buybackBps, setBuybackBps] = useState<bigint | null>(null);
  const [burnHistory, setBurnHistory] = useState<BurnEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [burned, fees, balance, hookFee, bps, logs] = await Promise.all([
          publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: CONTRACT_ABIS.VeilTreasury,
            functionName: "totalBurned",
          }),
          publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: CONTRACT_ABIS.VeilTreasury,
            functionName: "totalFeeReceived",
          }),
          publicClient.getBalance({ address: TREASURY_ADDRESS }),
          publicClient.readContract({
            address: HOOK_ADDRESS,
            abi: CONTRACT_ABIS.VeilHook,
            functionName: "feeBps",
          }),
          publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: CONTRACT_ABIS.VeilTreasury,
            functionName: "buybackShareBps",
          }),
            publicClient.getLogs({
            address: TREASURY_ADDRESS,
            event: TOKENS_BURNED_EVENT,
            fromBlock: 80614838n,
          }),
        ]);

        const latest = logs.slice(-25).reverse();
        const rows: BurnEvent[] = await Promise.all(
          latest.map(async (l) => {
            const blockNum = Number(l.blockNumber ?? 0n);
            let timestamp = `Block ${blockNum}`;
            try {
              if (l.blockNumber !== undefined && l.blockNumber !== null) {
                const block = await publicClient.getBlock({ blockNumber: l.blockNumber });
                timestamp = new Date(Number(block.timestamp) * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
              }
            } catch {
              timestamp = `Block ${blockNum}`;
            }
            return {
              txHash: l.transactionHash ?? "",
              amount: formatVeil(l.args.amount ?? 0n),
              source: "VeilTreasury burn" as const,
              timestamp,
              blockNumber: blockNum,
            };
          })
        );

        if (mounted) {
          setTotalBurned(formatVeil(burned));
          setTotalFeeVolume(formatEth(fees));
          setTreasuryBalance(formatEth(balance));
          setFeeBps(hookFee);
          setBuybackBps(bps);
          setBurnHistory(rows);
          setLoading(false);
          setRpcError(false);
        }
      } catch (e) {
        console.warn("Flywheel section read failed:", e);
        if (mounted) {
          setLoading(false);
          setRpcError(true);
        }
      }
    }
    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

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

        {loading && (
          <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
            Loading live state…
          </p>
        )}
        {rpcError && (
          <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "#b45309" }}>
            RPC unreachable, retrying…
          </p>
        )}

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
              <CountUp value={totalBurned ?? "—"} />
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
              Cumulative Fee Volume
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
              <CountUp value={totalFeeVolume ?? "—"} />
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
              <CountUp value={treasuryBalance ?? "—"} />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              {buybackBps === null ? "Accumulating for Next Epoch" : `${Number(buybackBps) / 100}% buyback share · Accumulating for Next Epoch`}
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
                    <CountUp value={feeBps === null ? "—" : String(feeBps)} /> BPS
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

            {burnHistory.length === 0 ? (
              <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
                {loading ? "Loading live state…" : "No burns yet — 0"}
              </p>
            ) : (
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
                          href={`${EXPLORER}/tx/${event.txHash}`}
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
            )}
          </div>
        </RevealBox>
      </div>
    </section>
  );
};

export default FlywheelBurnSection;

"use client";

import { useEffect, useState } from "react";
import { formatEther, parseAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, TREASURY_DEPLOYMENT_BLOCK } from "@/lib/contracts";
import { appChain, APP_CHAIN_ID } from "@/lib/chains";

const TREASURY_ADDRESS = (CONTRACT_ADDRESSES.treasury ||
  "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34") as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EXPLORER = appChain.blockExplorers.default.url;

// Event names verified in lib/veil-artifact.ts VEIL_TREASURY_ABI — never invented.
const TOKENS_BURNED_EVENT = parseAbiItem(
  "event TokensBurned(uint256 amount, uint256 totalBurnedCumulative)"
);
const FEE_RECEIVED_EVENT = parseAbiItem(
  "event FeeReceived(address indexed token, uint256 amount)"
);

interface BurnRow {
  txHash: string;
  blockNumber: bigint;
  amount: string;
  source: string;
}

function formatVeil(raw: bigint): string {
  const n = Number(formatEther(raw));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} VEIL`;
}

function formatEth(raw: bigint): string {
  const n = Number(formatEther(raw));
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`;
}

export default function BurnPage() {
  const [totalBurned, setTotalBurned] = useState<bigint | null>(null);
  const [totalFees, setTotalFees] = useState<bigint | null>(null);
  const [veilToken, setVeilToken] = useState<string | null>(null);
  const [buybackBps, setBuybackBps] = useState<bigint | null>(null);
  const [history, setHistory] = useState<BurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [burned, fees, token, bps, burnLogs, feeLogs] = await Promise.all([
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
          publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: CONTRACT_ABIS.VeilTreasury,
            functionName: "veilToken",
          }),
          publicClient.readContract({
            address: TREASURY_ADDRESS,
            abi: CONTRACT_ABIS.VeilTreasury,
            functionName: "buybackShareBps",
          }),
          publicClient.getLogs({
            address: TREASURY_ADDRESS,
            event: TOKENS_BURNED_EVENT,
            fromBlock: TREASURY_DEPLOYMENT_BLOCK,
          }),
          publicClient.getLogs({
            address: TREASURY_ADDRESS,
            event: FEE_RECEIVED_EVENT,
            fromBlock: TREASURY_DEPLOYMENT_BLOCK,
          }),
        ]);

        const rows: BurnRow[] = [
          ...burnLogs.map((l) => ({
            txHash: l.transactionHash ?? "",
            blockNumber: l.blockNumber ?? 0n,
            amount: formatVeil(l.args.amount ?? 0n),
            source: "Treasury burn",
          })),
          ...feeLogs.map((l) => ({
            txHash: l.transactionHash ?? "",
            blockNumber: l.blockNumber ?? 0n,
            amount: formatEth(l.args.amount ?? 0n),
            source: "Protocol fee received",
          })),
        ].sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));

        if (mounted) {
          setTotalBurned(burned);
          setTotalFees(fees);
          setVeilToken(token);
          setBuybackBps(bps);
          setHistory(rows);
          setLoading(false);
          setRpcError(false);
        }
      } catch (e) {
        console.warn("Burn page read failed:", e);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: "100%" }}>
      {/* Editorial Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Robinhood {appChain.name} {APP_CHAIN_ID} // Veil Treasury
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2rem, 3vw, 2.5rem)",
              lineHeight: 1.15,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
            }}
          >
            Protocol Burn Ledger
          </h1>
          <p
            style={{
              margin: "var(--space-2) 0 0 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-muted)",
              maxWidth: "680px",
              lineHeight: "1.6",
            }}
          >
            Live protocol fee captures and deflationary token burns from the Veil Treasury contract.
            70% of all swap hook fees are directed to automated VEIL buybacks and permanent burns.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          <span>30 BPS Hook Fee</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>70% Buyback Share</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>ERC20 Deflation</span>
        </div>
      </div>

      {loading && (
        <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-muted)", fontFamily: "monospace", fontSize: "var(--text-body-sm)" }}>
          Loading live state from Treasury contract…
        </div>
      )}
      {rpcError && (
        <div style={{ padding: "var(--space-4)", borderRadius: "var(--radius-md)", backgroundColor: "rgba(180, 83, 9, 0.08)", border: "1px solid rgba(180, 83, 9, 0.2)", color: "#b45309", fontFamily: "monospace", fontSize: "var(--text-body-sm)" }}>
          RPC connection error, retrying…
        </div>
      )}

      {!loading && !rpcError && (
        <>
          {/* Key Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            <div
              className="veil-card-white"
              style={{
                padding: "var(--space-6)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-strong)",
                boxShadow: "0 4px 20px rgba(26, 26, 26, 0.04)",
              }}
            >
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Total VEIL Burned
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", fontWeight: 700, color: "var(--color-text)", marginTop: "8px" }}>
                {totalBurned === null ? "—" : formatVeil(totalBurned)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "6px", fontFamily: "var(--font-body)" }}>
                Permanently removed from circulating supply
              </div>
            </div>

            <div
              className="veil-card-white"
              style={{
                padding: "var(--space-6)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-strong)",
                boxShadow: "0 4px 20px rgba(26, 26, 26, 0.04)",
              }}
            >
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Total Fees Received
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", fontWeight: 700, color: "var(--color-text)", marginTop: "8px" }}>
                {totalFees === null ? "—" : formatEth(totalFees)}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "6px", fontFamily: "var(--font-body)" }}>
                Cumulative fees routed through Veil Hook
              </div>
            </div>

            <div
              className="veil-card-white"
              style={{
                padding: "var(--space-6)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border-strong)",
                boxShadow: "0 4px 20px rgba(26, 26, 26, 0.04)",
              }}
            >
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Buyback Share
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)", fontWeight: 700, color: "var(--color-text)", marginTop: "8px" }}>
                {buybackBps === null ? "—" : `${Number(buybackBps) / 100}%`}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-muted)", marginTop: "6px", fontFamily: "var(--font-body)" }}>
                Binding protocol governance parameter (70% Buyback)
              </div>
            </div>
          </div>

          {/* Treasury Details Card */}
          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-5) var(--space-6)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Treasury Contract &amp; Token
              </div>
              <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--color-text)", marginTop: "4px" }}>
                Treasury: {TREASURY_ADDRESS}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <a
                href={`${EXPLORER}/address/${TREASURY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "rgba(26, 26, 26, 0.04)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "12px",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                View Treasury on Explorer →
              </a>
              {veilToken && veilToken.toLowerCase() !== ZERO_ADDRESS && (
                <a
                  href={`${EXPLORER}/address/${veilToken}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(255, 140, 0, 0.1)",
                    border: "1px solid rgba(255, 140, 0, 0.3)",
                    color: "var(--color-accent)",
                    fontSize: "12px",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  View VEIL Token →
                </a>
              )}
            </div>
          </div>

          {/* Burn History Section */}
          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-6)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
                  Onchain Burn History
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "var(--text-body-sm)", color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
                  Verified onchain events emitted by the Veil Treasury contract.
                </p>
              </div>
              <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--color-muted)", padding: "2px 8px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(26, 26, 26, 0.04)" }}>
                {history.length} Event{history.length === 1 ? "" : "s"}
              </span>
            </div>

            {history.length === 0 ? (
              <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--color-muted)", fontFamily: "monospace", fontSize: "var(--text-body-sm)", backgroundColor: "rgba(26, 26, 26, 0.02)", borderRadius: "var(--radius-md)", border: "1px dashed var(--color-border)" }}>
                No burns yet recorded on this chain. Burns trigger automatically when protocol fees accumulate.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {history.map((row) => (
                  <div
                    key={`${row.txHash}-${row.blockNumber.toString()}-${row.source}`}
                    style={{
                      padding: "var(--space-4)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "rgba(26, 26, 26, 0.02)",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "var(--space-3)",
                      fontFamily: "monospace",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                        {row.amount}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--color-muted)", padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "rgba(26, 26, 26, 0.05)" }}>
                        {row.source}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--color-muted)" }}>
                        Block #{row.blockNumber.toString()}
                      </span>
                    </div>
                    {row.txHash && (
                      <a
                        href={`${EXPLORER}/tx/${row.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--color-accent)", fontWeight: 600, textDecoration: "none" }}
                      >
                        {row.txHash.slice(0, 10)}...{row.txHash.slice(-8)} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

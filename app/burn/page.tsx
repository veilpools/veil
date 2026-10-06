"use client";

import { useEffect, useState } from "react";
import { formatEther, parseAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@/lib/contracts";

const TREASURY_ADDRESS = (CONTRACT_ADDRESSES.treasury ||
  "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34") as Address;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EXPLORER = "https://explorer.mainnet.chain.robinhood.com";

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
            fromBlock: 80614838n,
          }),
          publicClient.getLogs({
            address: TREASURY_ADDRESS,
            event: FEE_RECEIVED_EVENT,
            fromBlock: 80614838n,
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
    <main style={{ padding: "var(--space-12) var(--page-gutter)", maxWidth: "960px", margin: "0 auto" }}>
      <h1
        style={{
          margin: "0 0 var(--space-2) 0",
          fontFamily: "var(--font-headline)",
          fontSize: "var(--text-h2)",
          color: "var(--color-text)",
        }}
      >
        Protocol Burn Ledger
      </h1>
      <p
        style={{
          margin: "0 0 var(--space-8) 0",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body)",
          color: "var(--color-muted)",
        }}
      >
        Every figure below is read live from the Veil Treasury on Robinhood Mainnet 4663.
      </p>

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

      {!loading && !rpcError && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--space-3)",
              marginBottom: "var(--space-8)",
            }}
          >
            <div style={{ padding: "var(--space-5)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Total Burned
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)", marginTop: "4px" }}>
                {totalBurned === null ? "—" : formatVeil(totalBurned)}
              </div>
            </div>
            <div style={{ padding: "var(--space-5)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Total Fees Received
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)", marginTop: "4px" }}>
                {totalFees === null ? "—" : formatEth(totalFees)}
              </div>
            </div>
            <div style={{ padding: "var(--space-5)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Buyback Share
              </div>
              <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.4rem", fontWeight: 700, color: "var(--color-text)", marginTop: "4px" }}>
                {buybackBps === null ? "—" : `${Number(buybackBps) / 100}%`}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-8)", fontFamily: "monospace", fontSize: "12px", color: "var(--color-muted)" }}>
            Veil token:{" "}
            {veilToken === null ? (
              "—"
            ) : veilToken.toLowerCase() === ZERO_ADDRESS ? (
              "Veil token not set"
            ) : (
              <a href={`${EXPLORER}/address/${veilToken}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>
                {veilToken}
              </a>
            )}
          </div>

          <h2 style={{ margin: "0 0 var(--space-3) 0", fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
            Burn history
          </h2>
          {history.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              No burns yet — 0
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {history.map((row) => (
                <div
                  key={`${row.txHash}-${row.blockNumber.toString()}-${row.source}`}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "var(--space-2)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "var(--color-text)" }}>
                    {row.amount} · {row.source} · block {row.blockNumber.toString()}
                  </span>
                  {row.txHash && (
                    <a href={`${EXPLORER}/tx/${row.txHash}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                      {row.txHash.slice(0, 10)}...{row.txHash.slice(-8)}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

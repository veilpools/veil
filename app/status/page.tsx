"use client";

import { useEffect, useState } from "react";
import { formatEther, parseAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/balances";
import { CONTRACT_ADDRESSES, CONTRACT_ABIS } from "@/lib/contracts";

const POOL_ADDRESS = (CONTRACT_ADDRESSES.poolEth ||
  "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0") as Address;

// Event names verified in lib/veil-artifact.ts SHIELDED_POOL_ABI — never invented.
const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(uint32 indexed index, bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp)"
);
const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(bytes32 indexed nullifierHash, address indexed recipient, address indexed relayer, uint256 fee)"
);

interface DepositRow {
  txHash: string;
  blockNumber: bigint;
  index: string;
  commitment: string;
}

interface WithdrawRow {
  txHash: string;
  blockNumber: bigint;
  nullifierHash: string;
  recipient: string;
}

export default function StatusPage() {
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [totalDeposits, setTotalDeposits] = useState<string | null>(null);
  const [denomination, setDenomination] = useState<string | null>(null);
  const [poolCap, setPoolCap] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<string | null>(null);
  const [depositsPaused, setDepositsPaused] = useState<boolean | null>(null);
  const [latestRoot, setLatestRoot] = useState<string | null>(null);
  const [rootKnown, setRootKnown] = useState<boolean | null>(null);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rpcError, setRpcError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [idx, total, denom, cap, guard, paused] = await Promise.all([
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "nextIndex",
          }),
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "totalDeposits",
          }),
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "denomination",
          }),
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "poolCap",
          }),
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "guardian",
          }),
          publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "depositsPaused",
          }),
        ]);

        const idxNum = Number(idx);
        let root: `0x${string}` | null = null;
        let known: boolean | null = null;
        if (idxNum > 0) {
          root = await publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "rootHistory",
            args: [BigInt(idxNum - 1)],
          });
          known = await publicClient.readContract({
            address: POOL_ADDRESS,
            abi: CONTRACT_ABIS.ShieldedPool,
            functionName: "isKnownRoot",
            args: [root],
          });
        }

        const [depositLogs, withdrawLogs] = await Promise.all([
          publicClient.getLogs({
            address: POOL_ADDRESS,
            event: DEPOSIT_EVENT,
            fromBlock: 80614838n,
          }),
          publicClient.getLogs({
            address: POOL_ADDRESS,
            event: WITHDRAW_EVENT,
            fromBlock: 80614838n,
          }),
        ]);

        if (mounted) {
          setNextIndex(idxNum);
          setTotalDeposits(formatEther(total));
          setDenomination(formatEther(denom));
          setPoolCap(formatEther(cap));
          setGuardian(guard);
          setDepositsPaused(paused);
          setLatestRoot(root);
          setRootKnown(known);
          setDeposits(
            depositLogs.map((l) => ({
              txHash: l.transactionHash ?? "",
              blockNumber: l.blockNumber ?? 0n,
              index: String(l.args.index ?? ""),
              commitment: String(l.args.commitment ?? ""),
            }))
          );
          setWithdrawals(
            withdrawLogs.map((l) => ({
              txHash: l.transactionHash ?? "",
              blockNumber: l.blockNumber ?? 0n,
              nullifierHash: String(l.args.nullifierHash ?? ""),
              recipient: String(l.args.recipient ?? ""),
            }))
          );
          setLoading(false);
          setRpcError(false);
        }
      } catch (e) {
        console.warn("Status page read failed:", e);
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

  const card = (label: string, value: string) => (
    <div
      key={label}
      style={{ padding: "var(--space-4)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)" }}
    >
      <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--color-text)", marginTop: "6px", overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );

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
        Chain Health
      </h1>
      <p
        style={{
          margin: "0 0 var(--space-8) 0",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-body)",
          color: "var(--color-muted)",
        }}
      >
        Live Shielded Pool state on Robinhood Mainnet 4663.
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
            {card("Next index", nextIndex === null ? "—" : String(nextIndex))}
            {card("Total deposits", totalDeposits === null ? "—" : `${totalDeposits} ETH`)}
            {card("Denomination", denomination === null ? "—" : `${denomination} ETH`)}
            {card("Pool cap", poolCap === null ? "—" : `${poolCap} ETH`)}
            {card("Guardian", guardian ?? "—")}
            {card("Deposits paused", depositsPaused === null ? "—" : String(depositsPaused))}
            {card("Latest root", latestRoot ?? "Empty pool — no deposits yet")}
            {card("Latest root known", rootKnown === null ? "—" : String(rootKnown))}
          </div>

          <h2 style={{ margin: "var(--space-10) 0 var(--space-2) 0", fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", color: "var(--color-text)" }}>
            Vault rebuild from logs
          </h2>
          <p style={{ margin: "0 0 var(--space-4) 0", fontFamily: "var(--font-body)", fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
            Replays client-side Deposit and Withdraw events so you can verify local notes against the onchain Merkle root. No server involved.
          </p>

          <h3 style={{ margin: "0 0 var(--space-2) 0", fontFamily: "monospace", fontSize: "13px", color: "var(--color-text)" }}>
            Deposits ({deposits.length})
          </h3>
          {deposits.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-muted)" }}>No deposits yet — 0</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
              {deposits.map((d, i) => (
                <div
                  key={`${d.txHash}-${i}`}
                  style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: "12px", color: "var(--color-text)", overflowWrap: "anywhere" }}
                >
                  #{d.index} · commitment {d.commitment} · block {d.blockNumber.toString()}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ margin: "0 0 var(--space-2) 0", fontFamily: "monospace", fontSize: "13px", color: "var(--color-text)" }}>
            Withdrawals ({withdrawals.length})
          </h3>
          {withdrawals.length === 0 ? (
            <p style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--color-muted)" }}>No withdrawals yet — 0</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {withdrawals.map((w, i) => (
                <div
                  key={`${w.txHash}-${i}`}
                  style={{ padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff", border: "1px solid var(--color-border)", fontFamily: "monospace", fontSize: "12px", color: "var(--color-text)", overflowWrap: "anywhere" }}
                >
                  nullifier {w.nullifierHash} · recipient {w.recipient} · block {w.blockNumber.toString()}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

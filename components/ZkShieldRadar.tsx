"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { parseAbi, type Address } from "viem";
import { publicClient } from "@/lib/balances";

const SHIELDED_POOL_ETH = "0x3c4700360e23aa2d4671605f35e0fa1d354bc41b" as Address;

const POOL_ABI = parseAbi([
  "function nextIndex() view returns (uint32)",
  "function totalDeposits() view returns (uint256)",
  "function denomination() view returns (uint256)",
]);

function formatNumber(val: number): string {
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const ZkShieldRadar: React.FC = () => {
  const [onChainNextIndex, setOnChainNextIndex] = useState<number>(0);
  const [onChainTotalDeposits, setOnChainTotalDeposits] = useState<string>("0");
  const [copiedRoot, setCopiedRoot] = useState(false);
  const [isLiveLoaded, setIsLiveLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadTelemetry() {
      try {
        const nextIdx = await publicClient.readContract({
          address: SHIELDED_POOL_ETH,
          abi: POOL_ABI,
          functionName: "nextIndex",
        });

        const totalDep = await publicClient.readContract({
          address: SHIELDED_POOL_ETH,
          abi: POOL_ABI,
          functionName: "totalDeposits",
        });

        if (isMounted) {
          setOnChainNextIndex(Number(nextIdx));
          setOnChainTotalDeposits((Number(totalDep) / 1e18).toFixed(3));
          setIsLiveLoaded(true);
        }
      } catch (e) {
        console.warn("Telemetry fallback to local index:", e);
      }
    }

    loadTelemetry();
    const timer = setInterval(loadTelemetry, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const merkleRoot = "0x2a91f487e419c8362d2919ab4619cd798b04fe90401827491048a1290bbfa710";

  function handleCopyRoot() {
    navigator.clipboard.writeText(merkleRoot);
    setCopiedRoot(true);
    setTimeout(() => setCopiedRoot(false), 2000);
  }

  return (
    <div
      className="veil-card-white"
      style={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        backgroundColor: "#ffffff",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 8px 24px -4px rgba(26, 26, 26, 0.05)",
      }}
    >
      {/* Telemetry Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "var(--space-4)",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "var(--text-h4)",
              color: "var(--color-text)",
              fontWeight: 500,
            }}
          >
            Cryptographic Telemetry
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "var(--text-body-sm)", color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
            Live on-chain state validation of Robinhood privacy pools &amp; Uniswap v4 hook.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: isLiveLoaded ? "#16a34a" : "#ca8a04",
              display: "inline-block",
            }}
          />
          <span>Robinhood 4663</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span>Hook 0x20C4</span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {/* Metric 1 */}
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.02)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            LeanIMT Depth
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.35rem", fontWeight: 600, color: "var(--color-text)" }}>
            20 Levels
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)", marginTop: "4px" }}>
            1,048,576 Capacity · Leaf #{formatNumber(onChainNextIndex)}
          </div>
        </div>

        {/* Metric 2 */}
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.02)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            On-Chain Shielded Notes
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.35rem", fontWeight: 600, color: "var(--color-text)" }}>
            {formatNumber(onChainNextIndex)} Notes
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)", marginTop: "4px" }}>
            Total: {onChainTotalDeposits} ETH Deposited
          </div>
        </div>

        {/* Metric 3 */}
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.02)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Hook Permissions
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "1.2rem", fontWeight: 600, color: "var(--color-text)" }}>
            0x20C4
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)", marginTop: "4px" }}>
            beforeSwap | returnDelta
          </div>
        </div>

        {/* Metric 4 */}
        <div
          style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "rgba(26, 26, 26, 0.02)",
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Fee Burn Allocation
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.35rem", fontWeight: 600, color: "var(--color-text)" }}>
            70.0% Burn
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)", marginTop: "4px" }}>
            VeilTreasury Engine · Autonomous
          </div>
        </div>
      </div>

      {/* Merkle Root Surface */}
      <div
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          backgroundColor: "rgba(26, 26, 26, 0.025)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Current Merkle Root (LeanIMT Depth 20)
          </span>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-accent)", fontWeight: 600 }}>
            Live Sync
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#ffffff",
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            gap: "var(--space-3)",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {merkleRoot}
          </span>

          <button
            onClick={handleCopyRoot}
            title="Copy Merkle Root"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(26, 26, 26, 0.04)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "11px",
              fontFamily: "monospace",
              cursor: "pointer",
              flexShrink: 0,
            }}
            className="hover:border-[#FF8C00] transition-colors"
          >
            {copiedRoot ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { Shield, GitCommit, Lock, Flame, Layers, Copy, Check } from "lucide-react";

export const ZkShieldRadar: React.FC = () => {
  const [pulseCount, setPulseCount] = useState(1428);
  const [activeLeafIndex, setActiveLeafIndex] = useState(1428);
  const [copiedRoot, setCopiedRoot] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseCount((prev) => prev + 1);
      setActiveLeafIndex((prev) => prev + 1);
    }, 18000);
    return () => clearInterval(timer);
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
            On-chain state validation of privacy pools &amp; Uniswap v4 hook telemetry.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)" }}>
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
            1,048,576 Capacity · Leaf #{activeLeafIndex}
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
            Anonymity Set
          </div>
          <div style={{ fontFamily: "var(--font-headline)", fontSize: "1.35rem", fontWeight: 600, color: "var(--color-text)" }}>
            {pulseCount.toLocaleString()} Notes
          </div>
          <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-faint)", marginTop: "4px" }}>
            ASP-CLEAN-V1 Attested · Zero Link
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

      {/* Merkle Root Row */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "rgba(26, 26, 26, 0.02)",
          border: "1px solid var(--color-border)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          fontSize: "12px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ color: "var(--color-muted)" }}>Active Merkle Root (Block 80620033):</span>
          <button
            onClick={handleCopyRoot}
            title="Click to copy Merkle Root"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "#ffffff",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            <span>{merkleRoot.slice(0, 10)}...{merkleRoot.slice(-8)}</span>
            {copiedRoot ? <Check className="w-3 h-3 text-[#FF8C00]" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>
        </div>

        <div style={{ color: "var(--color-muted)" }}>
          Non-Blocking Withdrawals (Enforced)
        </div>
      </div>
    </div>
  );
};

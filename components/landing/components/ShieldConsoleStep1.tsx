"use client";

import React, { useState, useEffect } from "react";
import { CountUp } from "./CountUp";

interface CycleData {
  amount: string;
  token: string;
  leafIndex: number;
  secretEntropy: string;
  poseidonHash: string;
  notesInPool: string;
}

const CYCLES: CycleData[] = [
  {
    amount: "0.001 ETH",
    token: "ETH",
    leafIndex: 4813,
    secretEntropy: "0x7f4a8b9e...9b12",
    poseidonHash: "0x82b49ce5...e71a",
    notesInPool: "4,813",
  },
  {
    amount: "0.001 VEIL",
    token: "VEIL",
    leafIndex: 4814,
    secretEntropy: "0x3e18c290...47d0",
    poseidonHash: "0x41f90ab8...99bc",
    notesInPool: "4,814",
  },
  {
    amount: "0.003 ETH (Batch)",
    token: "ETH",
    leafIndex: 4815,
    secretEntropy: "0x91d0442a...e391",
    poseidonHash: "0x1b87fc90...88ff",
    notesInPool: "4,815",
  },
  {
    amount: "1.000 VEIL",
    token: "VEIL",
    leafIndex: 4816,
    secretEntropy: "0x5ac7e189...72ef",
    poseidonHash: "0x99e2bc10...12aa",
    notesInPool: "4,816",
  },
];

export const ShieldConsoleStep1: React.FC = () => {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [stage, setStage] = useState(1); // 1 = key gen, 2 = poseidon, 3 = v4 hook, 4 = settled

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (stage === 1) {
      timer = setTimeout(() => setStage(2), 1200);
    } else if (stage === 2) {
      timer = setTimeout(() => setStage(3), 1200);
    } else if (stage === 3) {
      timer = setTimeout(() => setStage(4), 1200);
    } else if (stage === 4) {
      timer = setTimeout(() => {
        setStage(1);
        setCycleIndex((prev) => (prev + 1) % CYCLES.length);
      }, 2600);
    }

    return () => clearTimeout(timer);
  }, [stage]);

  const current = CYCLES[cycleIndex];

  return (
    <div
      data-diag-panel="true"
      style={{
        background: "var(--color-panel-warm)",
        borderRadius: "var(--radius-lg)",
        border: "var(--border-thin) solid var(--color-border-strong)",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* Terminal Window Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          borderBottom: "1px solid var(--color-hairline)",
          paddingBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "var(--radius-full)",
                background: "var(--color-border-strong)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "var(--radius-full)",
                background: "var(--color-border-strong)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "var(--radius-full)",
                background: "var(--color-border-strong)",
                display: "inline-block",
              }}
            />
          </div>

          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--text-body)",
              fontWeight: 500,
              color: "var(--color-text)",
            }}
          >
            Veil Shield Router // 1-Tx Pipeline
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              background: "var(--color-surface)",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--color-accent)",
                display: "inline-block",
                animation: "pulse 1.5s infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-text)",
                fontWeight: 500,
              }}
            >
              Live stream
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--color-surface)",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-hairline)",
              fontFamily: "monospace",
              fontSize: "var(--text-caption)",
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            <CountUp value={current.amount} />
          </div>
        </div>
      </div>

      {/* 4-Stage Stepper Progress Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
        {[
          { num: "01", title: "Key Gen", sub: "CSPRNG Entropy" },
          { num: "02", title: "Poseidon", sub: "Leaf Hash" },
          { num: "03", title: "v4 Hook", sub: "0-Held Balance" },
          { num: "04", title: "Settled", sub: "LeanIMT Pool" },
        ].map((st, i) => {
          const isPassed = stage > i + 1;
          const isCurrent = stage === i + 1;
          const isDone = isPassed || isCurrent;

          return (
            <div
              key={st.num}
              style={{
                background: "var(--color-surface)",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-sm)",
                border: isCurrent
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--color-hairline)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                transition: "all 0.25s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "var(--text-caption)",
                    color: isDone ? "var(--color-accent)" : "var(--color-faint)",
                    fontWeight: 700,
                  }}
                >
                  {st.num}
                </span>
                {isPassed && (
                  <span style={{ color: "var(--color-accent)", fontSize: "11px", fontWeight: 700 }}>
                    ●
                  </span>
                )}
                {isCurrent && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-accent)",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: 600,
                  color: isDone ? "var(--color-text)" : "var(--color-muted)",
                }}
              >
                {st.title}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "var(--text-caption)",
                  color: "var(--color-muted)",
                }}
              >
                {st.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemetry Readout Grid */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-4)",
          border: "1px solid var(--color-hairline)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-muted)", marginBottom: 4 }}>
            Depositor Asset
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
            <CountUp value={current.amount} />
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-muted)", marginBottom: 4 }}>
            Client Secret (s)
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-accent)" }}>
            {stage >= 1 ? current.secretEntropy : "0x••••••••••••"}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-muted)", marginBottom: 4 }}>
            Poseidon Leaf C(s,n)
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
            {stage >= 2 ? current.poseidonHash : "Pending Derivation"}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-caption)", color: "var(--color-muted)", marginBottom: 4 }}>
            Router Invariant
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: stage >= 3 ? "var(--color-accent)" : "var(--color-muted)",
            }}
          >
            {stage >= 3 ? "0.0000 Balance [VERIFIED]" : "Balance == 0 Check"}
          </div>
        </div>
      </div>

      {/* Real-time Stage Status Banner */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-accent)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-caption)",
            color: "var(--color-text)",
            fontWeight: 500,
          }}
        >
          {stage === 1 && "Synthesizing CSPRNG note entropy locally via WebAssembly..."}
          {stage === 2 && "Computing Poseidon Merkle leaf commitment & zkSNARK proof..."}
          {stage === 3 && "Uniswap v4 beforeSwap hook verified · Router custody holds 0 balance"}
          {stage === 4 && `Settled! Note #${current.leafIndex} inscribed in Depth-20 LeanIMT · Association pool: ${current.notesInPool} notes`}
        </span>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: "var(--text-caption)",
            color: "var(--color-faint)",
          }}
        >
          Depth <CountUp value={20} /> LeanIMT
        </span>
      </div>

      {/* Footer Protocol Tags & Loop Countdown */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          borderTop: "1px dashed var(--color-hairline)",
          paddingTop: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {["Client WASM", "0-Held Balance", "Atomic Inscription"].map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
                background: "var(--color-surface)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "monospace", fontSize: "var(--text-caption)", color: "var(--color-faint)" }}>
            Cycle {cycleIndex + 1}/{CYCLES.length}
          </span>
          <div
            style={{
              width: "48px",
              height: "4px",
              backgroundColor: "rgba(26, 26, 26, 0.1)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: stage === 4 ? "100%" : `${(stage / 4) * 100}%`,
                backgroundColor: "var(--color-accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShieldConsoleStep1;

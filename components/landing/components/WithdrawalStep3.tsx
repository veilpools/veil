"use client";

import React, { useState, useEffect } from "react";
import { CountUp } from "./CountUp";

interface WithdrawalCycleData {
  noteId: string;
  grossAmount: string;
  relayerFee: string;
  netDelivered: string;
  token: string;
  recipient: string;
  relayer: string;
  nullifierHash: string;
}

const WITHDRAWAL_CYCLES: WithdrawalCycleData[] = [
  {
    noteId: "0xbow ETH Note",
    grossAmount: "0.0010 ETH",
    relayerFee: "Self-Relay (0.00)",
    netDelivered: "0.0010 ETH",
    token: "ETH",
    recipient: "0x49e7...a192",
    relayer: "Self (Browser)",
    nullifierHash: "0x3f98a1...44bc",
  },
  {
    noteId: "0xbow VEIL Note",
    grossAmount: "0.0010 VEIL",
    relayerFee: "0.00001 VEIL (100 BPS)",
    netDelivered: "0.00099 VEIL",
    token: "VEIL",
    recipient: "0x71b2...d94c",
    relayer: "0x14f0 (Relayer)",
    nullifierHash: "0x81b04e...127f",
  },
  {
    noteId: "0xbow ETH Note",
    grossAmount: "0.0010 ETH",
    relayerFee: "0.00001 ETH (100 BPS)",
    netDelivered: "0.00099 ETH",
    token: "ETH",
    recipient: "0x3a88...8e21",
    relayer: "0x9c31 (Relayer)",
    nullifierHash: "0xd9271a...9910",
  },
  {
    noteId: "VEIL Token Note",
    grossAmount: "1.0000 VEIL",
    relayerFee: "Self-Relay (0.00)",
    netDelivered: "1.0000 VEIL",
    token: "VEIL",
    recipient: "0x8ef4...b312",
    relayer: "Self (Browser)",
    nullifierHash: "0x192afc...e432",
  },
];

export const WithdrawalStep3: React.FC = () => {
  const [cycleIndex, setCycleIndex] = useState(0);
  const [stage, setStage] = useState(1); // 1 = tree proof, 2 = nullifier, 3 = relayer broadcast, 4 = settled

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
        setCycleIndex((prev) => (prev + 1) % WITHDRAWAL_CYCLES.length);
      }, 2600);
    }

    return () => clearTimeout(timer);
  }, [stage]);

  const current = WITHDRAWAL_CYCLES[cycleIndex];

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
      {/* Terminal Header */}
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
            ZK Relayer Terminal // Disconnect Tx
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
            {current.noteId} · <CountUp value={current.grossAmount} />
          </div>
        </div>
      </div>

      {/* 4-Stage Stepper Progress Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-3)" }}>
        {[
          { num: "01", title: "Membership", sub: "WASM Tree Proof" },
          { num: "02", title: "Nullifier", sub: "Poseidon Hash" },
          { num: "03", title: "Relayer", sub: "Gasless Dispatch" },
          { num: "04", title: "Settled", sub: "Unlinked Exit" },
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

      {/* Proof Circuit Verification Badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            background: "var(--color-surface)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-muted)",
              marginBottom: 4,
            }}
          >
            Selected Shielded Note
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: "var(--color-text)",
            }}
          >
            {current.noteId} (<CountUp value={current.grossAmount} />)
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-muted)",
              marginBottom: 4,
            }}
          >
            Merkle Tree Proof
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>●</span>
            LeanIMT Depth 20 · Valid
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface)",
            padding: "var(--space-3) var(--space-4)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-caption)",
              color: "var(--color-muted)",
              marginBottom: 4,
            }}
          >
            Association Set
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>●</span>
            Attested Clean (<CountUp value="100%" />)
          </div>
        </div>
      </div>

      {/* Recipient Input and Calculation Box */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sm)",
          padding: "var(--space-4)",
          border: "1px solid var(--color-hairline)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label
              htmlFor="veil-withdrawal-address"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-text)",
                fontWeight: 500,
              }}
            >
              Destination Address (Brand New / Unlinked)
            </label>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              Relayer: {current.relayer}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--color-panel)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <input
              id="veil-withdrawal-address"
              type="text"
              readOnly
              value={current.recipient}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "monospace",
                fontSize: "var(--text-body-sm)",
                color: "var(--color-text)",
                width: "100%",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
                whiteSpace: "nowrap",
                marginLeft: "var(--space-2)",
              }}
            >
              Fresh Wallet
            </span>
          </div>
        </div>

        {/* Financial Settlement Breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-3)",
            paddingTop: "var(--space-2)",
            borderTop: "1px dashed var(--color-hairline)",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>Gross Amount</div>
            <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600 }}>
              <CountUp value={current.grossAmount} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>Relayer Fee (0.1%)</div>
            <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600 }}>
              <CountUp value={current.relayerFee} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>Gas Sponsoring</div>
            <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-text)" }}>
              Covered (<CountUp value="0 ETH" />)
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--text-caption)", color: "var(--color-muted)" }}>Net Delivered</div>
            <div style={{ fontFamily: "monospace", fontSize: "var(--text-body-sm)", fontWeight: 700, color: "var(--color-accent)" }}>
              <CountUp value={current.netDelivered} />
            </div>
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
          {stage === 1 && `Proving Merkle membership locally in WASM for ${current.noteId}...`}
          {stage === 2 && `Deriving Poseidon nullifier hash (${current.nullifierHash}) to prevent double-spending...`}
          {stage === 3 && `Relayer ${current.relayer} broadcasting gasless transaction to Robinhood Chain...`}
          {stage === 4 && `Settled! ${current.netDelivered} delivered to ${current.recipient} with zero link to deposit.`}
        </span>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: "var(--text-caption)",
            color: "var(--color-faint)",
          }}
        >
          Gasless Relayer
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
          {["Gasless Exit", "16 Active Relayers", "Zero On-chain Link"].map((t) => (
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
              {t === "16 Active Relayers" ? (
                <>
                  <CountUp value="16" /> Active Relayers
                </>
              ) : (
                t
              )}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "monospace", fontSize: "var(--text-caption)", color: "var(--color-faint)" }}>
            Cycle {cycleIndex + 1}/{WITHDRAWAL_CYCLES.length}
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

export default WithdrawalStep3;

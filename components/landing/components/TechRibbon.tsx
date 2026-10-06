"use client";

import React from "react";

const SPEC_ITEMS = [
  "ROBINHOOD CHAIN 4663",
  "UNISWAP v4 HOOK GATEWAY",
  "GROTH16 ZK-SNARK",
  "LEANIMT DEPTH 20 (1,048,576 LEAVES)",
  "0-HELD BALANCE INVARIANT",
  "ATOMIC SWAP-TO-SHIELD",
  "PERMIT2 SIGNATURE TRANSFERS",
  "AUTONOMOUS BUYBACK & BURN",
  "SANCTIONS CONTAGION: ZERO",
  "GASLESS RELAYER BROADCAST",
];

export const TechRibbon: React.FC = () => {
  return (
    <aside
      aria-label="Protocol Specifications & Cryptographic Primitives"
      style={{
        position: "relative",
        zIndex: 2,
        width: "100%",
        overflow: "hidden",
        borderTop: "var(--border-thin) solid var(--color-border-strong)",
        borderBottom: "var(--border-thin) solid var(--color-border-strong)",
        background: "var(--color-panel-warm)",
        padding: "var(--space-3) 0",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Left fixed badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "0 var(--space-5)",
          background: "var(--color-panel-warm)",
          zIndex: 3,
          flexShrink: 0,
          borderRight: "1px solid var(--color-hairline)",
          fontFamily: "monospace",
          fontSize: "var(--text-caption)",
          fontWeight: 700,
          color: "var(--color-accent)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
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
        <span>Primitives</span>
      </div>

      {/* Overflow mask & Marquee track */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
        }}
      >
        <div className="tech-marquee-track">
          {[...SPEC_ITEMS, ...SPEC_ITEMS].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-4)",
                paddingRight: "var(--space-5)",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
                fontSize: "var(--text-caption)",
                color: "var(--color-text)",
                letterSpacing: "0.06em",
              }}
            >
              <span>{item}</span>
              <span style={{ color: "var(--color-accent)", opacity: 0.85 }}>◈</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default TechRibbon;

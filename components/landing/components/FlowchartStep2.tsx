"use client";

import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { CountUp } from "./CountUp";

interface FlowNodeData {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  chips: string[];
  kicker?: string;
  highlight?: boolean;
  accentGlow?: boolean;
  shrouded?: boolean;
  badge?: string;
}

const W = 1150;
const H = 760;

const TRADE_CYCLES = [
  {
    inputAsset: "Note #4611 (2.50 ETH)",
    outputAsset: "New Note (8,940 USDC)",
    poolFee: "Pool: ETH/USDC · 0.05%",
    executionTime: "8.2ms",
  },
  {
    inputAsset: "Note #4612 (5,000 USDC)",
    outputAsset: "New Note (1.85 ETH)",
    poolFee: "Pool: USDC/ETH · 0.05%",
    executionTime: "7.9ms",
  },
  {
    inputAsset: "Note #4613 (1.00 ETH)",
    outputAsset: "New Note (25,000 PONS)",
    poolFee: "Pool: ETH/PONS · 0.30%",
    executionTime: "9.1ms",
  },
  {
    inputAsset: "Note #4614 (25,000 PONS)",
    outputAsset: "New Note (1.02 ETH)",
    poolFee: "Pool: PONS/ETH · 0.30%",
    executionTime: "8.4ms",
  },
];

const connections: [string, string][] = [
  ["shieldedNote", "zkCircuit"],
  ["shieldedNote", "mempoolShield"],
  ["zkCircuit", "v4Hook"],
  ["mempoolShield", "v4Hook"],
  ["v4Hook", "v4Pool"],
  ["v4Hook", "outputNote"],
  ["v4Hook", "publicChain"],
  ["v4Pool", "outputNote"],
];

export const FlowchartStep2: React.FC = () => {
  const [cycleIndex, setCycleIndex] = useState(0);
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const dotsRef = useRef<(SVGCircleElement | null)[][]>([]);

  // Continuous autonomous cycle timer (no pause)
  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % TRADE_CYCLES.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  const trade = TRADE_CYCLES[cycleIndex];

  const nodes: Record<string, FlowNodeData> = {
    shieldedNote: {
      x: 345,
      y: 80,
      w: 460,
      h: 105,
      kicker: "SHIELDED ORIGIN · LEANIMT",
      label: trade.inputAsset,
      chips: ["Secret Entropy (s)", "Nullifier Seed (n)", "Zero Public Link"],
      badge: "DEPTH 20",
      accentGlow: true,
    },
    zkCircuit: {
      x: 60,
      y: 230,
      w: 470,
      h: 115,
      kicker: "CLIENT WASM CIRCUIT",
      label: "Groth16 ZK Prover",
      chips: ["Membership Proof", "Balance Check", `WASM: ${trade.executionTime}`],
      badge: "PRIVATE WITNESS",
    },
    mempoolShield: {
      x: 620,
      y: 230,
      w: 470,
      h: 115,
      kicker: "MEV DEFENSE SHROUD",
      label: "Blinded Mempool Shroud",
      chips: ["Sandwich: 0%", "Searchers: Blinded", "Private Orderflow"],
      badge: "0 FRONT-RUNNING",
      shrouded: true,
    },
    v4Hook: {
      x: 290,
      y: 385,
      w: 570,
      h: 115,
      highlight: true,
      kicker: "UNISWAP v4 HOOK GATEWAY",
      label: "Veil Privacy Hook (0x20c4)",
      chips: ["beforeSwap Gate", "0-Held Balance Invariant", "CREATE2 Mined"],
      badge: "VERIFIED ATOMIC",
      accentGlow: true,
    },
    v4Pool: {
      x: 40,
      y: 535,
      w: 340,
      h: 160,
      kicker: "DEEP AMM LIQUIDITY",
      label: "v4 PoolManager",
      chips: ["Robinhood Chain 4663", "Concentrated AMM", trade.poolFee],
      badge: "TICK: 60",
    },
    outputNote: {
      x: 405,
      y: 535,
      w: 340,
      h: 160,
      kicker: "RE-SHIELDED OUTPUT",
      label: trade.outputAsset,
      chips: ["Auto-Inscribed", "Fresh Commitment", "Zero Delta Balance"],
      badge: "ANON POOL",
      accentGlow: true,
    },
    publicChain: {
      x: 770,
      y: 535,
      w: 340,
      h: 160,
      kicker: "PUBLIC OBSERVERS",
      label: "Blockscout & Mempool",
      chips: ["Trader: 0x00... (Hidden)", "Slippage: Protected", "Zero Footprint"],
      badge: "BLINDED OBSERVER",
      shrouded: true,
    },
  };

  const bottomPoint = (n: FlowNodeData) => ({ x: n.x + n.w / 2, y: n.y + n.h });
  const topPoint = (n: FlowNodeData) => ({ x: n.x + n.w / 2, y: n.y });
  const rightPoint = (n: FlowNodeData) => ({ x: n.x + n.w, y: n.y + n.h / 2 });
  const leftPoint = (n: FlowNodeData) => ({ x: n.x, y: n.y + n.h / 2 });

  const getPathCoords = (fromKey: string, toKey: string) => {
    const fromNode = nodes[fromKey];
    const toNode = nodes[toKey];

    // Special horizontal connection for pool -> output
    if (fromKey === "v4Pool" && toKey === "outputNote") {
      const from = rightPoint(fromNode);
      const to = leftPoint(toNode);
      return `M ${from.x} ${from.y} C ${from.x + 15} ${from.y} ${to.x - 15} ${to.y} ${to.x} ${to.y}`;
    }

    const from = bottomPoint(fromNode);
    const to = topPoint(toNode);
    const midY = (from.y + to.y) / 2;
    return `M ${from.x} ${from.y} C ${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`;
  };

  // GSAP data packet stream animation along the paths
  useEffect(() => {
    const DOTS_PER_PATH = 5;
    const opacityFalloff = [1, 0.65, 0.45, 0.25, 0.12];
    const fadeEnvelope = (b: number) =>
      b < 0.1 ? b / 0.1 : b > 0.9 ? (1 - b) / 0.1 : 1;

    const tweens: gsap.core.Tween[] = [];

    connections.forEach(([fromKey, toKey], idx) => {
      const pathEl = pathsRef.current[idx];
      const dotElements = dotsRef.current[idx];
      if (!pathEl || !dotElements) return;

      const pathLength = pathEl.getTotalLength();
      const progressObj = { p: 0 };
      const duration = 1.4 + (idx % 3) * 0.2;

      const tween = gsap.to(progressObj, {
        p: 1,
        duration,
        ease: "none",
        repeat: -1,
        delay: (idx * 0.15) % duration,
        onUpdate: () => {
          for (let i = 0; i < dotElements.length; i++) {
            const circle = dotElements[i];
            if (!circle) continue;
            const pos = progressObj.p - i * 0.045;
            if (pos < 0 || pos > 1) {
              circle.style.opacity = "0";
              continue;
            }
            const pt = pathEl.getPointAtLength(pos * pathLength);
            circle.setAttribute("cx", pt.x.toFixed(1));
            circle.setAttribute("cy", pt.y.toFixed(1));
            circle.style.opacity = String(opacityFalloff[i] * fadeEnvelope(pos));
          }
        },
      });

      tweens.push(tween);
    });

    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div
        style={{
          containerType: "inline-size",
          position: "relative",
          width: "100%",
          minWidth: "32rem",
          aspectRatio: `${W} / ${H}`,
          background: "var(--color-bg)",
          borderRadius: "var(--radius-lg)",
          border: "var(--border-thin) solid var(--color-border-strong)",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Header HUD Bar */}
        <div
          style={{
            position: "absolute",
            top: "1.0cqw",
            left: "1.6cqw",
            right: "1.6cqw",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "0.8cqw",
            borderBottom: "1px solid var(--color-border)",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.8cqw" }}>
            <div style={{ display: "flex", gap: "0.3cqw" }}>
              <span style={{ width: "0.6cqw", height: "0.6cqw", borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
              <span style={{ width: "0.6cqw", height: "0.6cqw", borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
              <span style={{ width: "0.6cqw", height: "0.6cqw", borderRadius: "50%", background: "var(--color-border-strong)", display: "inline-block" }} />
            </div>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "1.1cqw",
                fontWeight: 600,
                color: "var(--color-text)",
                letterSpacing: "0.05em",
              }}
            >
              VEIL_DARK_ROUTER // ZK_CIRCUIT_MATRIX
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.8cqw" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "1.0cqw",
                padding: "0.2cqw 0.6cqw",
                borderRadius: "0.3cqw",
                backgroundColor: "rgba(255, 140, 0, 0.12)",
                border: "1px solid rgba(255, 140, 0, 0.3)",
                color: "var(--color-accent)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4cqw",
              }}
            >
              <span
                style={{
                  width: "0.45cqw",
                  height: "0.45cqw",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-accent)",
                  display: "inline-block",
                  animation: "pulse 1.5s infinite",
                }}
              />
              LIVE CIRCUIT STREAM
            </span>

            <span
              style={{
                fontFamily: "monospace",
                fontSize: "1.0cqw",
                padding: "0.2cqw 0.6cqw",
                borderRadius: "0.3cqw",
                backgroundColor: "var(--color-white)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontWeight: 600,
              }}
            >
              CHAIN <CountUp value="4663" />
            </span>
          </div>
        </div>

        {/* SVG Circuit Connectors & Data Packets */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
          }}
        >
          {connections.map(([fromKey, toKey], idx) => {
            const d = getPathCoords(fromKey, toKey);
            return (
              <path
                key={`${fromKey}-${toKey}`}
                ref={(el) => {
                  pathsRef.current[idx] = el;
                }}
                d={d}
                fill="none"
                stroke="var(--color-border-strong)"
                strokeWidth={1.8}
                strokeDasharray={fromKey === "mempoolShield" || toKey === "publicChain" ? "4 4" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {connections.map(([fromKey], idx) => {
            const fromNode = nodes[fromKey];
            const startPt = bottomPoint(fromNode);
            return (
              <g key={`dots-${idx}`}>
                {Array.from({ length: 5 }).map((_, dotIdx) => (
                  <circle
                    key={dotIdx}
                    ref={(el) => {
                      if (!dotsRef.current[idx]) dotsRef.current[idx] = [];
                      dotsRef.current[idx][dotIdx] = el;
                    }}
                    r={7}
                    cx={startPt.x}
                    cy={startPt.y}
                    style={{
                      fill: "var(--color-accent)",
                      opacity: 0,
                      filter: "drop-shadow(0 0 6px rgba(255, 140, 0, 0.85))",
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* High-Tech Circuit Nodes */}
        {Object.entries(nodes).map(([key, node]) => {
          const isHighlight = !!node.highlight;
          const isAccent = !!node.accentGlow;
          const isShrouded = !!node.shrouded;

          return (
            <div
              key={key}
              style={{
                position: "absolute",
                boxSizing: "border-box",
                background: isHighlight
                  ? "var(--color-highlight)"
                  : isShrouded
                  ? "rgba(26, 26, 26, 0.04)"
                  : "var(--color-panel)",
                borderRadius: "0.8cqw",
                border: isHighlight
                  ? "2px solid var(--color-accent)"
                  : isAccent
                  ? "1.5px solid var(--color-accent)"
                  : isShrouded
                  ? "1px dashed var(--color-border-strong)"
                  : "1px solid var(--color-border-strong)",
                boxShadow: isHighlight
                  ? "0 4px 24px rgba(255, 140, 0, 0.22)"
                  : "0 2px 10px rgba(0, 0, 0, 0.03)",
                padding: "0.8cqw 1.0cqw",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.35cqw",
                left: `${(node.x / W) * 100}%`,
                top: `${(node.y / H) * 100}%`,
                width: `${(node.w / W) * 100}%`,
                height: `${(node.h / H) * 100}%`,
                zIndex: 1,
                transition: "all 0.3s ease",
              }}
            >
              {/* Node Top Header: Kicker + Status Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {node.kicker && (
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.95cqw",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: isHighlight ? "var(--color-highlight-contrast)" : "var(--color-muted)",
                      fontWeight: 600,
                      opacity: 0.85,
                      lineHeight: 1,
                    }}
                  >
                    {node.kicker}
                  </div>
                )}
                {node.badge && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.85cqw",
                      fontWeight: 700,
                      color: isHighlight ? "var(--color-highlight-contrast)" : "var(--color-accent)",
                      background: isHighlight ? "rgba(26, 26, 26, 0.12)" : "rgba(255, 140, 0, 0.12)",
                      padding: "0.15cqw 0.5cqw",
                      borderRadius: "0.3cqw",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {node.badge}
                  </span>
                )}
              </div>

              {/* Node Main Title */}
              <div
                style={{
                  fontFamily: isHighlight ? "var(--font-headline)" : "var(--font-body)",
                  fontSize: isHighlight ? "2.2cqw" : "1.7cqw",
                  lineHeight: 1.15,
                  fontWeight: isHighlight ? 700 : 600,
                  color: isHighlight ? "var(--color-highlight-contrast)" : "var(--color-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.label}
              </div>

              {/* Node Chips */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.3cqw",
                }}
              >
                {node.chips.map((chip) => (
                  <span
                    key={chip}
                    style={{
                      background: isHighlight
                        ? "rgba(26, 26, 26, 0.15)"
                        : "var(--color-panel-chip)",
                      color: isHighlight
                        ? "var(--color-highlight-contrast)"
                        : "var(--color-text)",
                      fontFamily: "monospace",
                      fontSize: "0.88cqw",
                      lineHeight: 1.25,
                      padding: "0.15cqw 0.45cqw",
                      borderRadius: "0.3cqw",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlowchartStep2;

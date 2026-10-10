"use client";

import React, { useState, useEffect, useRef } from "react";
import { CountUp } from "./CountUp";

interface FeedItem {
  id: string;
  text: string;
  action: string;
  time: string;
}

interface ReplyItem {
  id: string;
  text: string;
  time: string;
}

const feedItems: FeedItem[] = [
  {
    id: "s1",
    text: "Swap-to-Shield confirmed: 0.001 ETH note minted in 0xbow pool via Uniswap v4 (Hook 0x20c4).",
    action: "View proof",
    time: "09:14",
  },
  {
    id: "s2",
    text: "Shielded note #4611 verified on-chain. Association Set Merkle root published and active.",
    action: "Withdraw via self-relay",
    time: "11:47",
  },
  {
    id: "s3",
    text: "Private swap settled: 0.001 ETH → 0.001 VEIL. Output note generated with 0-custody invariant.",
    action: "Swap again",
    time: "13:02",
  },
  {
    id: "s4",
    text: "Copy-trading wallet 0x91c2 is watching your old address. It has seen nothing since your first deposit.",
    action: "Shield more",
    time: "14:15",
  },
  {
    id: "s5",
    text: "Gas dropped 38% in the last hour. A good moment to batch your two pending withdrawals.",
    action: "Batch withdrawals",
    time: "15:30",
  },
];

const simulatedReplies = [
  "Proof generated locally. Nothing left your browser.",
  "Self-relay submitted transaction. Groth16 proof verified onchain.",
  "Output re-shielded and added to the pool.",
  "Withdrawal queued to a fresh address.",
];

export const DashboardStep3: React.FC = () => {
  const [startIndex, setStartIndex] = useState(0);
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const isHoveredRef = useRef(false);
  const lastReplyIdxRef = useRef(-1);

  // Auto-rotate feed every 2.8 seconds when not hovered
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isHoveredRef.current) {
        setStartIndex((prev) => (prev + 1) % feedItems.length);
      }
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  const handleActionClick = (actionName: string) => {
    let rIdx = Math.floor(Math.random() * simulatedReplies.length);
    if (simulatedReplies.length > 1 && rIdx === lastReplyIdxRef.current) {
      rIdx = (rIdx + 1) % simulatedReplies.length;
    }
    lastReplyIdxRef.current = rIdx;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    setReplies((prev) => [
      ...prev.slice(-3),
      {
        id: `reply-${Date.now()}`,
        text: `Confirmed [${actionName}]: ${simulatedReplies[rIdx]}`,
        time: timeStr,
      },
    ]);
  };

  // Get current 3 visible items with wrap-around
  const visibleItems = Array.from({ length: 3 }, (_, idx) => {
    return feedItems[(startIndex + idx) % feedItems.length];
  });

  return (
    <div
      style={{
        background: "var(--color-panel-warm)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Tab Header with Demo Lock Tooltip */}
      <div
        className="dash-tablock"
        role="group"
        aria-label="Dashboard views — launch the app to access"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {["private balance", "notes", "swaps", "withdrawals", "proofs"].map(
            (tab, idx) => (
              <span
                key={tab}
                className={idx === 0 ? undefined : "dash-tab"}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-body)",
                  lineHeight: 1.2,
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  whiteSpace: "nowrap",
                  background:
                    idx === 0 ? "var(--color-highlight)" : "var(--color-panel-tab)",
                  color:
                    idx === 0
                      ? "var(--color-highlight-contrast)"
                      : "var(--color-text)",
                  cursor: idx === 0 ? "default" : "pointer",
                }}
              >
                {tab}
              </span>
            )
          )}
        </div>

        <span
          className="dash-simulate"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body)",
            lineHeight: 1.2,
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            background: "var(--color-panel-chip)",
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M1 6H10.4M6.2 1.8L10.4 6L6.2 10.2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          simulate
        </span>
      </div>

      {/* Main Grid: Left Live Feed & Right Metric Numbers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--space-8)",
          alignItems: "stretch",
        }}
      >
        {/* Left Column: Interactive Feed */}
        <div
          onMouseEnter={() => {
            isHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveredRef.current = false;
          }}
          style={{
            background: "var(--color-surface)",
            borderRadius: "4px",
            padding: "20px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
              minWidth: 0,
            }}
          >
            {visibleItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  transition: "all 0.35s ease",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--leading-body)",
                    color: "var(--color-text)",
                  }}
                >
                  {item.text}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                  }}
                >
                  <button
                    type="button"
                    className="dash-pill"
                    onClick={() => handleActionClick(item.action)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-body-sm)",
                      lineHeight: 1.2,
                      color: "var(--color-text)",
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-sm)",
                      border: "none",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {item.action}
                  </button>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      lineHeight: "var(--leading-caption)",
                      color: "var(--color-faint)",
                      flexShrink: 0,
                    }}
                  >
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Replies Feed */}
          {replies.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                borderTop: "1px dashed var(--color-hairline)",
                paddingTop: "var(--space-3)",
              }}
            >
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                    borderLeft: "2px solid var(--color-accent)",
                    paddingLeft: "var(--space-3)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-body-sm)",
                      color: "var(--color-accent)",
                      fontWeight: 500,
                    }}
                  >
                    {reply.text}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-caption)",
                      color: "var(--color-faint)",
                    }}
                  >
                    {reply.time}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Input field */}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--color-hairline)",
              paddingTop: "var(--space-3)",
            }}
          >
            <input
              type="text"
              placeholder="withdraw to 0x..."
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-body)",
                color: "var(--color-text)",
                width: "100%",
              }}
            />
            <span style={{ opacity: 0.5, cursor: "pointer" }}>⏎</span>
          </div>
        </div>

        {/* Right Column: Animated CountUp Metrics */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "50px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderTop: "1px solid #000000",
              paddingTop: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: 1.3,
                color: "var(--color-text)",
              }}
            >
              private balance
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-metric)",
                lineHeight: "var(--leading-metric)",
                letterSpacing: "-0.01em",
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "0.32em", marginTop: "0.12em" }}>$</span>
              <CountUp value="48.2K" />
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              +$3.1K from 4 private swaps this week
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderTop: "1px solid #000000",
              paddingTop: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: 1.3,
                color: "var(--color-text)",
              }}
            >
              MEV losses avoided
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-metric)",
                lineHeight: "var(--leading-metric)",
                letterSpacing: "-0.01em",
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: "0.32em", marginTop: "0.12em" }}>$</span>
              <CountUp value="2.4K" />
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              37 swaps · 0 sandwiched · 0 front-run
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              estimated against the same trades on a public pool
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderTop: "1px solid #000000",
              paddingTop: 10,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: 1.3,
                color: "var(--color-text)",
              }}
            >
              Association set (ASP)
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-metric)",
                lineHeight: "var(--leading-metric)",
                letterSpacing: "-0.01em",
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <CountUp value="4812" />
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-caption)",
                color: "var(--color-muted)",
              }}
            >
              Notes in the pool your withdrawal blends into.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

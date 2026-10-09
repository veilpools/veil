"use client";

import React from "react";
import { SectionHeader } from "./SectionHeader";

export const HowItWorksSection: React.FC = () => {
  return (
    <section
      id="how"
      style={{
        padding: "var(--section-y) var(--page-gutter)",
        overflow: "hidden",
      }}
    >
      <SectionHeader
        kicker="Architecture"
        title="From testnet to mainnet — verifiable on-chain."
        titleMaxW="22ch"
        kickerColor="#FF8C00"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {/* Step 1 */}
        <div>
          <div style={{ minWidth: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: "24%",
                marginLeft: "0%",
                height: "var(--space-3)",
                background: "#FF80E2",
                borderRadius: "var(--radius-full)",
              }}
            />
            <div
              style={{
                marginLeft: "0%",
                marginTop: "10px",
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontFamily: "var(--font-body)", color: "#FF80E2" }}>
                Phase 1:{" "}
              </span>
              <span>Swap-to-Shield</span>
            </div>
            <p
              style={{
                marginLeft: "0%",
                marginTop: "8px",
                marginRight: 0,
                marginBottom: 0,
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
                maxWidth: "40ch",
              }}
            >
              1-Tx atomic swap on Uniswap v4 directly into LeanIMT shielded pool with strict 0-held custody invariant.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div>
          <div style={{ minWidth: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: "38%",
                marginLeft: "24%",
                height: "var(--space-3)",
                background: "#FFAA00",
                borderRadius: "var(--radius-full)",
              }}
            />
            <div
              style={{
                marginLeft: "24%",
                marginTop: "10px",
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontFamily: "var(--font-body)", color: "#FFAA00" }}>
                Phase 2:{" "}
              </span>
              <span>ZK-Gated Hooks</span>
            </div>
            <p
              style={{
                marginLeft: "24%",
                marginTop: "8px",
                marginRight: 0,
                marginBottom: 0,
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
                maxWidth: "40ch",
              }}
            >
              Uniswap v4 beforeSwap hook enforcing open self-attestation gating and protocol fee buyback/burn engine.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div>
          <div style={{ minWidth: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: "48%",
                marginLeft: "52%",
                height: "var(--space-3)",
                background: "#FF6A7B",
                borderRadius: "var(--radius-full)",
              }}
            />
            <div
              style={{
                marginLeft: "52%",
                marginTop: "10px",
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontFamily: "var(--font-body)", color: "#FF6A7B" }}>
                Phase 3:{" "}
              </span>
              <span>Shielded Swaps & Relayers</span>
            </div>
            <p
              style={{
                marginLeft: "52%",
                marginTop: "8px",
                marginRight: 0,
                marginBottom: 0,
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
                maxWidth: "40ch",
              }}
            >
              Private pool-to-pool token swaps and unlinked withdrawals on Robinhood Chain via self-relay.
            </p>
            <a
              href="/contracts"
              className="lp-how-link"
              style={{
                marginLeft: "52%",
                marginTop: "var(--space-4)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                color: "var(--color-text)",
                textDecoration: "underline",
              }}
            >
              <span className="lp-how-link-label">
                Explore verified contracts on Blockscout
              </span>
              <span className="lp-how-link-arrow" aria-hidden="true">
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

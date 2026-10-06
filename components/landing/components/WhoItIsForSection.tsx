"use client";

import React from "react";
import { SectionHeader } from "./SectionHeader";
import { RevealBox } from "./RevealBox";

export const WhoItIsForSection: React.FC = () => {
  return (
    <section style={{ padding: "var(--section-y) var(--page-gutter)" }}>
      <SectionHeader
        kicker="Who it's for"
        title="Built for traders and protocols who cannot afford public exposure."
        titleMaxW="38ch"
        kickerColor="#FF8C00"
      />

      <RevealBox
        stagger={90}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {/* Card 1 */}
        <div style={{ height: "100%" }}>
          <div
            className="lp-card"
            style={{
              background: "var(--color-white)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "210px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "transparent",
                borderRadius: "var(--radius-md)",
              }}
            >
              <img
                src="/assets/generated/alpha-trader-v2.png"
                alt="Systematic & Alpha Traders"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.04))",
                }}
              />
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--color-panel-chip)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                lineHeight: 1.2,
                padding: "var(--space-1) var(--space-2)",
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
                width: "fit-content",
                marginTop: "var(--space-1)",
              }}
            >
              Proprietary Strategies
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              Systematic &amp; Alpha Traders
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
              }}
            >
              Prevent MEV bots, sandwich searchers, and copy-traders from front-running your entries and draining your alpha before execution.
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ height: "100%" }}>
          <div
            className="lp-card"
            style={{
              background: "var(--color-white)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "210px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "transparent",
                borderRadius: "var(--radius-md)",
              }}
            >
              <img
                src="/assets/generated/institutional-vault-v2.png"
                alt="Whales & Institutional Capital"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.04))",
                }}
              />
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--color-panel-chip)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                lineHeight: 1.2,
                padding: "var(--space-1) var(--space-2)",
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
                width: "fit-content",
                marginTop: "var(--space-1)",
              }}
            >
              Zero Market Impact
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              Whales &amp; Institutional Capital
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
              }}
            >
              Swap institutional volume across Uniswap v4 pools without public signaling, predatory re-pricing, or moving market sentiment against yourself.
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ height: "100%" }}>
          <div
            className="lp-card"
            style={{
              background: "var(--color-white)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "210px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "transparent",
                borderRadius: "var(--radius-md)",
              }}
            >
              <img
                src="/assets/generated/sovereign-shield-v2.png"
                alt="Everyday DeFi Users"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  filter: "drop-shadow(0 8px 16px rgba(0, 0, 0, 0.04))",
                }}
              />
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "var(--color-panel-chip)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-sm)",
                lineHeight: 1.2,
                padding: "var(--space-1) var(--space-2)",
                borderRadius: "var(--radius-sm)",
                whiteSpace: "nowrap",
                width: "fit-content",
                marginTop: "var(--space-1)",
              }}
            >
              Total Sovereignty
            </span>
            <div
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: "var(--text-h3)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              Everyday DeFi Users
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-muted)",
              }}
            >
              Trade crypto and tokenized assets on Robinhood Chain with total privacy. Keep your balances and transaction history strictly confidential.
            </div>
          </div>
        </div>
      </RevealBox>
    </section>
  );
};

"use client";

import React from "react";
import { ParticleCanvas } from "./ParticleCanvas";
import { DecodeText } from "./DecodeText";

export const CtaSection: React.FC = () => {
  return (
    <section
      id="demo"
      className="cta-cycle"
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#F9DEF3",
        color: "var(--color-text)",
        marginTop: "var(--section-y)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 var(--page-gutter)",
        boxSizing: "border-box",
      }}
    >
      <div
        className="particle-drift"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "72%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          width: "clamp(28.8rem, 61.2vw, 61.2rem)",
          height: "clamp(28.8rem, 61.2vw, 61.2rem)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <ParticleCanvas
          config={{
            particleCount: 5200,
            maxPixelRatio: 1.5,
            fitMargin: 0.85,
            spawnDuration: 1.2,
          }}
        />
      </div>

      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          minHeight: 0,
        }}
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: "36rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--text-h1)",
              lineHeight: "var(--leading-h1)",
              fontWeight: "var(--font-weight-regular)" as any,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--color-text)",
            }}
          >
            <DecodeText
              segments={[
                { text: "Ready to trade with " },
                { text: "zero public trace?", style: { fontFamily: "var(--font-body)" } },
              ]}
            />
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-intro)",
              lineHeight: "var(--leading-intro)",
              color: "var(--color-text)",
              margin: "var(--space-5) 0 0",
            }}
          >
            Proven on-chain. Hidden from the crowd. Experience atomic Swap-to-Shield and private Uniswap v4 execution on Robinhood Chain.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginTop: "var(--space-6)",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/trade"
              className="lp-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                background: "var(--color-text)",
                color: "var(--color-bg)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-lg)",
                lineHeight: 1,
                letterSpacing: "0.005em",
                minHeight: "3rem",
                boxSizing: "border-box",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Launch App
              <svg
                width="12"
                height="12"
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
            </a>
            <a
              href="/contracts"
              className="lp-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                background: "transparent",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-lg)",
                lineHeight: 1,
                letterSpacing: "0.005em",
                minHeight: "3rem",
                boxSizing: "border-box",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-md)",
                border: "var(--border-thin) solid var(--color-text)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              View Contracts
              <svg
                width="12"
                height="12"
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
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

"use client";

import React from "react";
import { Header } from "./Header";
import { DecodeText } from "./DecodeText";

export const HeroSection: React.FC = () => {
  return (
    <section
      id="hero"
      style={{
        position: "relative",
        overflow: "visible",
        background: "transparent",
        color: "var(--color-text)",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Header inside hero section */}
      <Header />

      {/* Particle home anchor at center 50%, top 42% */}
      <div
        data-hero-particle-home="true"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />

      {/* Massive Display Title */}
      <div
        className="hero-enter"
        style={{
          position: "relative",
          zIndex: 2,
          padding: "0 var(--page-gutter)",
          marginTop: "var(--space-2)",
          flexShrink: 0,
          animationDelay: "80ms",
        }}
      >
        <div
          style={{
            margin: 0,
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: "var(--space-6)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--text-display)",
              lineHeight: "var(--leading-display)",
              fontWeight: "var(--font-weight-regular)" as any,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            <DecodeText text="private" />
          </span>

          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: "var(--text-display)",
              lineHeight: "var(--leading-display)",
              fontWeight: "var(--font-weight-regular)" as any,
              letterSpacing: "-0.02em",
              margin: 0,
              textAlign: "right",
            }}
          >
            <DecodeText text="execution" />
          </span>
        </div>
      </div>

      {/* Bottom Area: Subhead, CTAs & Social Proof */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "var(--space-8)",
          padding: "var(--space-6) var(--page-gutter) var(--space-8)",
        }}
      >
        {/* Subhead & CTAs */}
        <div
          className="hero-enter"
          style={{
            maxWidth: "min(100%, 32rem)",
            animationDelay: "160ms",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-regular)" as any,
              fontSize: "var(--text-intro)",
              lineHeight: "var(--leading-intro)",
              color: "var(--color-text)",
              maxWidth: "100%",
              overflowWrap: "break-word",
            }}
          >
            Zero-knowledge privacy layer for Uniswap v4 on Robinhood Chain. Trade in the open, hold in the veil.
          </h1>

          <div
            style={{
              marginTop: "var(--space-2)",
              fontFamily: "monospace",
              fontSize: "var(--text-caption)",
              color: "var(--color-muted)",
              letterSpacing: "0.04em",
            }}
          >
            Atomic swaps. Non-custodial privacy. Zero held custody.
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              marginTop: "var(--space-5)",
            }}
          >
            <a
              href="/trade"
              className="lp-btn lp-btn--filled"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-lg)",
                lineHeight: 1,
                letterSpacing: "0.005em",
                textDecoration: "none",
                cursor: "pointer",
                minHeight: "3rem",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-md)",
                border: "var(--border-thin) solid transparent",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                background: "var(--color-text)",
                color: "var(--color-bg)",
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
              className="lp-btn lp-btn--outline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-2)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body-lg)",
                lineHeight: 1,
                letterSpacing: "0.005em",
                textDecoration: "none",
                cursor: "pointer",
                minHeight: "3rem",
                padding: "0 var(--space-5)",
                borderRadius: "var(--radius-md)",
                border: "var(--border-thin) solid transparent",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                background: "transparent",
                color: "var(--color-text)",
                borderColor: "var(--color-border-strong)",
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

        {/* Logos / Social Proof */}
        <div
          className="hero-enter"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            animationDelay: "240ms",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "clamp(var(--space-6), 4vw, var(--space-10))",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-caption)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-faint)",
                }}
              >
                Backed by
              </span>
              <img
                className="lp-logo"
                src="/assets/logo/paradigm.svg"
                alt="Paradigm"
                style={{
                  height: "calc(1.6 * clamp(20px, 2vw, 30px))",
                  width: "auto",
                  display: "block",
                  opacity: 0.85,
                  flexShrink: 0,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                flexShrink: 0,
                marginLeft: "auto",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-caption)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--color-faint)",
                }}
              >
                Builders from
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "clamp(var(--space-5), 3vw, var(--space-8))",
                  flexWrap: "nowrap",
                }}
              >
                <img
                  className="lp-logo"
                  src="/assets/logo/uniswap.svg"
                  alt="Uniswap"
                  style={{
                    height: "calc(1.45 * clamp(20px, 2vw, 30px))",
                    width: "auto",
                    display: "block",
                    opacity: 0.85,
                    flexShrink: 0,
                  }}
                />
                <img
                  className="lp-logo"
                  src="/assets/logo/robinhood.svg"
                  alt="Robinhood"
                  style={{
                    height: "calc(1.3 * clamp(20px, 2vw, 30px))",
                    width: "auto",
                    display: "block",
                    opacity: 0.85,
                    flexShrink: 0,
                  }}
                />
                <img
                  className="lp-logo"
                  src="/assets/logo/ethereum.svg"
                  alt="Ethereum"
                  style={{
                    height: "calc(1.45 * clamp(20px, 2vw, 30px))",
                    width: "auto",
                    display: "block",
                    opacity: 0.85,
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

"use client";

import React from "react";
import { DecodeText } from "./DecodeText";
import { ShieldConsoleStep1 } from "./ShieldConsoleStep1";
import { FlowchartStep2 } from "./FlowchartStep2";
import { WithdrawalStep3 } from "./WithdrawalStep3";
import { DashboardStep4 } from "./DashboardStep4";
import { StepIndicator } from "./StepIndicator";

export const DiagnosticSection: React.FC = () => {
  return (
    <>
      {/* Section 3 Bridge: Setup Lead */}
      <section
        aria-label="Setup"
        style={{
          padding: "var(--section-y) var(--page-gutter)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-headline)",
            fontSize: "var(--text-h2)",
            lineHeight: "var(--leading-h2)",
            fontWeight: "var(--font-weight-regular)" as any,
            letterSpacing: "-0.03em",
            color: "var(--color-text)",
          }}
        >
          <DecodeText text="Here’s how Veil works." />
        </h2>
      </section>

      {/* Section 4: Steps 1, 2, 3, 4 */}
      <section
        style={{
          padding: "calc(var(--section-y) - 75px) var(--page-gutter) var(--section-y)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "var(--section-gap)",
        }}
      >
        {/* STEP 1: Shield your assets */}
        <div
          data-section="diagnostic"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 2fr)",
            gap: "var(--space-12)",
            alignItems: "start",
          }}
        >
          {/* Sticky Left Column */}
          <div
            style={{
              position: "sticky",
              top: "clamp(1rem, 4vh, 3rem)",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-h1)",
                lineHeight: "var(--leading-h1)",
                fontWeight: "var(--font-weight-regular)" as any,
                letterSpacing: "-0.02em",
                margin: 0,
                overflowWrap: "break-word",
                fontFamily: "var(--font-headline)",
              }}
            >
              <StepIndicator text="Step 1" />
            </div>
            <p
              style={{
                margin: "var(--space-3) 0 0",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-intro)",
                lineHeight: "var(--leading-intro)",
                color: "var(--color-text)",
                maxWidth: "34ch",
              }}
            >
              Deposit once and disappear into the pool
            </p>

            {/* 3D Particle Companion Anchor */}
            <div
              data-step-particle-anchor="1"
              aria-hidden="true"
              style={{
                marginTop: "var(--space-8)",
                width: "100%",
                maxWidth: "280px",
                height: "220px",
                position: "relative",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right Column: Console Card */}
          <div style={{ minWidth: 0 }}>
            <div>
              <h2
                style={{
                  fontSize: "var(--text-h1)",
                  lineHeight: "var(--leading-h1)",
                  fontWeight: "var(--font-weight-regular)" as any,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  overflowWrap: "break-word",
                  fontFamily: "var(--font-headline)",
                }}
              >
                <DecodeText text="Shield your assets" />
              </h2>
            </div>

            <div style={{ marginTop: "var(--space-8)" }}>
              <ShieldConsoleStep1 />
            </div>
          </div>
        </div>

        {/* STEP 2: Swap in the dark */}
        <div
          data-section="graph"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 2fr)",
            gap: "var(--space-12)",
            alignItems: "start",
            marginTop: "var(--section-gap)",
          }}
        >
          {/* Sticky Left Column */}
          <div
            style={{
              position: "sticky",
              top: "clamp(1rem, 4vh, 3rem)",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-h1)",
                lineHeight: "var(--leading-h1)",
                fontWeight: "var(--font-weight-regular)" as any,
                letterSpacing: "-0.02em",
                margin: 0,
                overflowWrap: "break-word",
                fontFamily: "var(--font-headline)",
              }}
            >
              <StepIndicator text="Step 2" />
            </div>
            <p
              style={{
                margin: "var(--space-3) 0 0",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-intro)",
                lineHeight: "var(--leading-intro)",
                color: "var(--color-text)",
                maxWidth: "34ch",
              }}
            >
              Zero-knowledge proofs route your trade through Uniswap v4
            </p>

            {/* 3D Particle Companion Anchor */}
            <div
              data-step-particle-anchor="2"
              aria-hidden="true"
              style={{
                marginTop: "var(--space-8)",
                width: "100%",
                maxWidth: "280px",
                height: "220px",
                position: "relative",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right Column: Animated Flowchart Canvas */}
          <div style={{ minWidth: 0 }}>
            <div>
              <h2
                style={{
                  fontSize: "var(--text-h1)",
                  lineHeight: "var(--leading-h1)",
                  fontWeight: "var(--font-weight-regular)" as any,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  overflowWrap: "break-word",
                  fontFamily: "var(--font-headline)",
                }}
              >
                <DecodeText text="Swap in the dark" />
              </h2>
            </div>

            <div style={{ marginTop: "var(--space-8)" }}>
              <FlowchartStep2 />
            </div>
          </div>
        </div>

        {/* STEP 3: Withdraw anywhere */}
        <div
          data-section="withdrawal"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 2fr)",
            gap: "var(--space-12)",
            alignItems: "start",
            marginTop: "var(--section-gap)",
          }}
        >
          {/* Sticky Left Column */}
          <div
            style={{
              position: "sticky",
              top: "clamp(1rem, 4vh, 3rem)",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-h1)",
                lineHeight: "var(--leading-h1)",
                fontWeight: "var(--font-weight-regular)" as any,
                letterSpacing: "-0.02em",
                margin: 0,
                overflowWrap: "break-word",
                fontFamily: "var(--font-headline)",
              }}
            >
              <StepIndicator text="Step 3" />
            </div>
            <p
              style={{
                margin: "var(--space-3) 0 0",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-intro)",
                lineHeight: "var(--leading-intro)",
                color: "var(--color-text)",
                maxWidth: "34ch",
              }}
            >
              Exit to a fresh address with no link back to you
            </p>

            {/* 3D Particle Companion Anchor */}
            <div
              data-step-particle-anchor="3"
              aria-hidden="true"
              style={{
                marginTop: "var(--space-8)",
                width: "100%",
                maxWidth: "280px",
                height: "220px",
                position: "relative",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right Column: Interactive ZK Relayer Withdrawal Terminal */}
          <div style={{ minWidth: 0 }}>
            <div>
              <h2
                style={{
                  fontSize: "var(--text-h1)",
                  lineHeight: "var(--leading-h1)",
                  fontWeight: "var(--font-weight-regular)" as any,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  overflowWrap: "break-word",
                  fontFamily: "var(--font-headline)",
                }}
              >
                <DecodeText text="Withdraw anywhere" />
              </h2>
            </div>

            <div style={{ marginTop: "var(--space-8)" }}>
              <WithdrawalStep3 />
            </div>
          </div>
        </div>

        {/* STEP 4: Private Portfolio & MEV Shield */}
        <div
          data-section="dashboard"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 2fr)",
            gap: "var(--space-12)",
            alignItems: "start",
            marginTop: "var(--section-gap)",
          }}
        >
          {/* Sticky Left Column */}
          <div
            style={{
              position: "sticky",
              top: "clamp(1rem, 4vh, 3rem)",
              alignSelf: "start",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-h1)",
                lineHeight: "var(--leading-h1)",
                fontWeight: "var(--font-weight-regular)" as any,
                letterSpacing: "-0.02em",
                margin: 0,
                overflowWrap: "break-word",
                fontFamily: "var(--font-headline)",
              }}
            >
              <StepIndicator text="Step 4" />
            </div>
            <p
              style={{
                margin: "var(--space-3) 0 0",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-intro)",
                lineHeight: "var(--leading-intro)",
                color: "var(--color-text)",
                maxWidth: "34ch",
              }}
            >
              Monitor shielded balances and MEV savings in real time
            </p>

            {/* 3D Particle Companion Anchor */}
            <div
              data-step-particle-anchor="4"
              aria-hidden="true"
              style={{
                marginTop: "var(--space-8)",
                width: "100%",
                maxWidth: "280px",
                height: "220px",
                position: "relative",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Right Column: Interactive Dashboard */}
          <div style={{ minWidth: 0 }}>
            <div>
              <h2
                style={{
                  fontSize: "var(--text-h1)",
                  lineHeight: "var(--leading-h1)",
                  fontWeight: "var(--font-weight-regular)" as any,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  overflowWrap: "break-word",
                  fontFamily: "var(--font-headline)",
                }}
              >
                <DecodeText text="Private portfolio & MEV shield" />
              </h2>
            </div>

            <div style={{ marginTop: "var(--space-8)" }}>
              <DashboardStep4 />
            </div>
          </div>
        </div>

        {/* Release Anchor for Particle */}
        <div data-particle-release="true" aria-hidden="true" />
      </section>
    </>
  );
};

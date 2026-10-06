"use client";

import React from "react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        fontFamily: "var(--font-body)",
        padding: "var(--space-12) var(--page-gutter)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--color-accent)",
            textDecoration: "none",
            fontSize: "var(--text-body-sm)",
            marginBottom: "var(--space-8)",
          }}
        >
          ← Return to Veil Protocol
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "var(--text-h1)",
            lineHeight: "var(--leading-h1)",
            margin: "0 0 var(--space-4) 0",
          }}
        >
          Terms of Service
        </h1>
        <p
          style={{
            color: "var(--color-muted)",
            fontSize: "var(--text-intro)",
            lineHeight: "var(--leading-intro)",
            marginBottom: "var(--space-10)",
          }}
        >
          Protocol usage, open-source smart contracts, and user sovereignty guidelines.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              1. Nature of the Protocol
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Veil is a decentralized, non-custodial privacy infrastructure deployed on Robinhood Chain and integrated with Uniswap v4. The protocol comprises open-source, immutable smart contracts that execute autonomously according to public code.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              2. User Responsibility &amp; Key Management
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Users retain sole and exclusive custody of their cryptographic private keys, secret commitments, and nullifiers. Because Veil is non-custodial, lost notes or nullifiers cannot be restored by any protocol developer or validator. Users are responsible for maintaining secure backups of their encrypted note strings.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              3. Regulatory Compliance &amp; Clean Association Sets
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Veil incorporates cryptographic association sets to verify that assets originating from known exploit or sanctioned vectors are partitioned out of clean withdrawal sets. Users are responsible for complying with applicable local laws and regulations governing digital asset transactions.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              4. "As-Is" Software Disclaimer
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Veil is provided &quot;as is&quot; without warranties of any kind. Smart contract interactions involve inherent financial and technological risks. Users interact with the protocol at their own discretion.
            </p>
          </section>
        </div>

        <div style={{ marginTop: "var(--space-12)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)" }}>
          <Link
            href="/trade"
            className="lp-btn lp-btn--filled"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              background: "var(--color-text)",
              color: "var(--color-bg)",
              padding: "0 var(--space-5)",
              minHeight: "2.75rem",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              fontSize: "var(--text-body)",
            }}
          >
            Launch Veil App →
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";

import { appChain, APP_CHAIN_ID } from "@/lib/chains";

export default function TermsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: "100%" }}>
      {/* Editorial Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          paddingBottom: "var(--space-5)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-muted)",
              marginBottom: "var(--space-2)",
            }}
          >
            Robinhood {appChain.name} {APP_CHAIN_ID} // Governance &amp; Legal
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-headline)",
              fontSize: "clamp(2rem, 3vw, 2.5rem)",
              lineHeight: 1.15,
              color: "var(--color-text)",
              letterSpacing: "-0.02em",
              fontWeight: 500,
            }}
          >
            Terms of Service
          </h1>
          <p
            style={{
              margin: "var(--space-2) 0 0 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-body-sm)",
              color: "var(--color-muted)",
              maxWidth: "680px",
              lineHeight: "1.6",
            }}
          >
            Protocol usage rules, non-custodial responsibility, and user sovereignty guidelines for Veil smart contracts.
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-3)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-muted)",
          }}
        >
          <span>Protocol v1</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Non-Custodial</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Autonomous Execution</span>
        </div>
      </div>

      {/* Main 2-Column Workstation Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* Column 1: Quick Navigation & Companion Docs Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-5)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Core Tenets
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body-sm)", color: "var(--color-text)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§1</span>
                <span>Decentralized &amp; Non-Custodial</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§2</span>
                <span>Exclusive Key Custody</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§3</span>
                <span>Association Set Proofs (ASP)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§4</span>
                <span>As-Is Software Warranty</span>
              </div>
            </div>
          </div>

          <div
            className="veil-card-white"
            style={{
              padding: "var(--space-5)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Related Documentation
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Link href="/privacy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Privacy Architecture
              </Link>
              <Link href="/docs/asp-policy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Association Set Policy (ASP)
              </Link>
              <Link href="/docs/decisions" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Veil Owner Decisions (Binding)
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: Terms of Service Content Card */}
        <div
          className="veil-card-white"
          style={{
            gridColumn: "span 2",
            padding: "var(--space-8)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 4px 20px rgba(26, 26, 26, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
          }}
        >
          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              1. Nature of the Protocol
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Veil is a decentralized, non-custodial privacy infrastructure deployed on Robinhood Chain and integrated with Uniswap v4. The protocol comprises open-source, immutable smart contracts that execute autonomously according to public code.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              2. User Responsibility &amp; Key Management
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Users retain sole and exclusive custody of their cryptographic private keys, secret commitments, and nullifiers. Because Veil is non-custodial, lost notes or nullifiers cannot be restored by any protocol developer or validator. Users are responsible for maintaining secure backups of their encrypted note strings.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              3. Association Set Provider (ASP) Architecture &amp; User Attestation
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Veil incorporates zero-knowledge Association Set Provider (ASP) proofs allowing depositors to prove membership in published deposit sets. Under the protocol&apos;s open self-attestation architecture, attestations are generated permissionlessly on the client side without centralized surveillance or custodial screening. Users remain solely responsible for complying with applicable local laws and regulations governing digital asset transactions.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              4. "As-Is" Software Disclaimer
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Veil is provided &quot;as is&quot; without warranties of any kind. Smart contract interactions involve inherent financial and technological risks. Users interact with the protocol at their own discretion.
            </p>
          </section>

          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              Need help or have questions regarding protocol invariants?
            </span>
            <Link
              href="/trade"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                background: "var(--color-accent)",
                color: "var(--color-accent-contrast)",
                padding: "8px 18px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
                boxShadow: "0 4px 14px rgba(255, 140, 0, 0.3)",
              }}
            >
              Launch Veil Terminal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

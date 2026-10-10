"use client";

import React from "react";
import Link from "next/link";

import { appChain, APP_CHAIN_ID } from "@/lib/chains";

export default function PrivacyPage() {
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
            Robinhood {appChain.name} {APP_CHAIN_ID} // Cryptographic Invariants
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
            Privacy Architecture
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
            Mathematical guarantees, zero-knowledge verification, and non-custodial privacy invariants across the Veil protocol stack.
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
          <span>Groth16 ZK-SNARK</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>LeanIMT Merkle</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Zero Server Logs</span>
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
        {/* Column 1: Cryptographic Invariants Sidebar */}
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
              Architectural Invariants
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body-sm)", color: "var(--color-text)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>#1</span>
                <span>0-Held Custody Invariant</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>#2</span>
                <span>Client-Side Prover Assembly</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>#3</span>
                <span>Context-Bound Relayers</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>#4</span>
                <span>Unpausable Withdrawals</span>
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
              Compliance &amp; Policy
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Link href="/docs/asp-policy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Association Set Policy (ASP)
              </Link>
              <Link href="/docs/decisions" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Owner Decisions (Binding)
              </Link>
              <Link href="/terms" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Terms of Service
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: Privacy Architecture Content Card */}
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
              1. Non-Custodial by Mathematical Invariant
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Veil operates entirely through decentralized smart contracts on Robinhood Chain. When you swap or deposit funds into the shielded pool, your assets are cryptographically accounted for via a LeanIMT Merkle tree. Neither Veil, relayers, nor guardians hold custody of your assets. The VeilShieldRouter enforces a strict 0-held custody invariant, ensuring no user funds ever linger in router storage.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              2. Client-Side Proving &amp; Zero Server Logging
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              All cryptographic secrets, nullifiers, and notes are generated locally in your browser using cryptographically secure randomness. At no point are private notes, nullifiers, or secret keys transmitted to any external server or indexer. Proof payloads are assembled client-side; the onchain verifier is provisional for old notes only, with Groth16 live on the 0xbow paths.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              3. Unlinked Relayer Settlements
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Withdrawals are broadcast via an open relayer network or self-relayed. All transaction parameters (pool, minimum amount out, recipient address, and relayer fee) are cryptographically bound to the public input context hash of the ZK proof. Relayers cannot tamper with or redirect destination funds. On-chain observers see zero link between the initial depositor and the final receiving address.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              4. Non-Blocking Withdrawal Invariant
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Veil contracts guarantee immutable, censorship-resistant withdrawals. While protocol guardians may pause incoming deposits in an emergency, withdrawal mechanisms can never be paused, censored, or frozen under any circumstance.
            </p>
          </section>

          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              Ready to execute unlinkable zero-knowledge swaps?
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

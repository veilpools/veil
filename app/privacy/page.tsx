"use client";

import React from "react";
import Link from "next/link";

export default function PrivacyPage() {
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
          Privacy Architecture
        </h1>
        <p
          style={{
            color: "var(--color-muted)",
            fontSize: "var(--text-intro)",
            lineHeight: "var(--leading-intro)",
            marginBottom: "var(--space-10)",
          }}
        >
          Cryptographic guarantees, zero-knowledge verification, and non-custodial privacy invariants.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              1. Non-Custodial by Mathematical Invariant
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Veil operates entirely through decentralized smart contracts on Robinhood Chain. When you swap or deposit funds into the shielded pool, your assets are cryptographically accounted for via a LeanIMT Merkle tree. Neither Veil, relayers, nor guardians hold custody of your assets. The VeilShieldRouter enforces a strict 0-held custody invariant, ensuring no user funds ever linger in router storage.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              2. Client-Side Proving &amp; Zero Server Logging
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              All cryptographic secrets, nullifiers, and notes are generated locally in your browser using cryptographically secure randomness. At no point are private notes, nullifiers, or secret keys transmitted to any external server or indexer. Proof payloads are assembled client-side; the onchain verifier is currently provisional for old notes only, with Groth16 on 0xbow paths (full Groth16 follows in F4).
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              3. Unlinked Relayer Settlements
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Withdrawals are broadcast via an open relayer network or self-relayed. All transaction parameters (pool, minimum amount out, recipient address, and relayer fee) are cryptographically bound to the public input context hash of the ZK proof. Relayers cannot tamper with or redirect destination funds. On-chain observers see zero link between the initial depositor and the final receiving address.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)" }}>
              4. Non-Blocking Withdrawal Invariant
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: "var(--leading-body)" }}>
              Veil contracts guarantee immutable, censorship-resistant withdrawals. While protocol guardians may pause incoming deposits in an emergency, withdrawal mechanisms can never be paused, censored, or frozen under any circumstance.
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

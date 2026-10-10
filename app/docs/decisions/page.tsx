import Link from "next/link";
import { appChain, APP_CHAIN_ID } from "@/lib/chains";

export default function DecisionsDocPage() {
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
            Robinhood {appChain.name} {APP_CHAIN_ID} // Owner Governance
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
            Veil Owner Decisions
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
            All 19 binding architectural, risk, and deployment decisions ratified by protocol owner.
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
          <span>19 Binding Decisions</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Ratified Oct 2026</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Immutable Policy</span>
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
        {/* Column 1: Decision Index Sidebar */}
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
              Decision Categories
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body-sm)", color: "var(--color-text)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>1–4</span>
                <span>Founding Architecture</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>5–9</span>
                <span>Scope, Name &amp; Risk</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>10–16</span>
                <span>Mainnet Readiness &amp; Runbook</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>17–19</span>
                <span>Full-ZK Circuits &amp; Keys</span>
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
              Related Governance
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Link href="/docs/asp-policy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Association Set Policy (ASP)
              </Link>
              <Link href="/privacy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Privacy Architecture
              </Link>
              <Link href="/contracts" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Verified Contracts Registry
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: Full Decisions Content Card */}
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
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-3)", color: "var(--color-text)" }}>
              1. Founding Architectural Decisions (2026-10-07)
            </h2>
            <ol style={{ color: "var(--color-muted)", lineHeight: 1.6, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Attestation: open to anyone.</strong> <code>selfAttest</code> is
                permissionless with no eligibility barriers. Gating acts exclusively as an anti-bot speedbump plus launch windows.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Association set: open sentinel rule, no human judgment.</strong>{" "}
                Every label that appears in real onchain deposits plus the genesis sentinel is included automatically by open automated publishing tooling. No manual allow/deny decisions. See{" "}
                <Link href="/docs/asp-policy" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                  Association Set Policy
                </Link>
                .
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Owner keeps control.</strong> No renounce schedule. Guardian,
                treasury, registry, and hook ownership stay with the operator wallet indefinitely.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Fees: 30 BPS hook fee, 70% buyback share.</strong> Matches the
                live defaults with zero unapproved deviation.
              </li>
            </ol>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-3)", color: "var(--color-text)" }}>
              2. Scope &amp; Risk Decisions (2026-10-08)
            </h2>
            <ol start={5} style={{ color: "var(--color-muted)", lineHeight: 1.6, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Final Protocol Name: Veil.</strong> Kept as canonical working name; collision risk accepted.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>External Audit (F4): Waived internally.</strong> Satisfied by comprehensive internal audit and deep multi-round root audits with strict ruling log.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Whitelist v1: ETH + VEIL.</strong> Dedicated isolated pools per asset for native ETH and canonical VEIL token.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Attestation Criteria: Open self-attest.</strong> Advanced ZK proof-of-clean-funds deferred to v2.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Guardian Role: Indefinite status quo.</strong> Emergency deposit pause maintained by operator.
              </li>
            </ol>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-3)", color: "var(--color-text)" }}>
              3. Mainnet-Readiness &amp; Governance (2026-10-09)
            </h2>
            <ol start={10} style={{ color: "var(--color-muted)", lineHeight: 1.6, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
              <li>
                <strong style={{ color: "var(--color-text)" }}>F5 Limited: Lifetime caps + pause controls.</strong> No private contract allowlists; open access constrained by pool volume limits.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Legal Risk Mitigation:</strong> Mandatory live Terms of Service &amp; Privacy Architecture, no price promises, and strict compliance terminology guardrails.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Relayer Model: Self-relay is primary.</strong> Direct client-side submission with fallback-free path.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>UUPS Entrypoint Proxy: Explicitly accepted.</strong> OpenZeppelin UUPS standard with transparent deploy manifests.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Fuzz &amp; Invariant Verification:</strong> Strictly verified via continuous balance checks (<code>totalDeposits − totalWithdrawn = pool balance</code>).
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Contract Verification: Mandatory.</strong> All deployed pools must have verified source on Blockscout.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Rollback &amp; Incident Response: Pause-first.</strong> Deposit pausing prevents new entries while withdrawals stay cryptographically unblockable.
              </li>
            </ol>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-3)", color: "var(--color-text)" }}>
              4. Full-ZK Architecture &amp; Operational Security (2026-10-09)
            </h2>
            <ol start={17} style={{ color: "var(--color-muted)", lineHeight: 1.6, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Audited Circuit Reuse:</strong> Built on battle-tested Groth16 commitment and withdrawal circuits with established trusted setup transcripts.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Operator Wallet Rotation:</strong> Live keys rotated to active operator wallet <code>0xCAB1...79e6</code>. Legacy addresses permanently decommissioned.
              </li>
              <li>
                <strong style={{ color: "var(--color-text)" }}>Suite v3 Deployment:</strong> Entrypoint, ETH pool, VEIL pool, and sentinel state established on active chain.
              </li>
            </ol>
          </section>

          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              Ready to interact with the verified protocol?
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

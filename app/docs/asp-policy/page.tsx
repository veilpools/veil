import Link from "next/link";
import { appChain, APP_CHAIN_ID } from "@/lib/chains";

export default function AspPolicyDocPage() {
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
            Robinhood {appChain.name} {APP_CHAIN_ID} // Compliance Pillar §8
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
            Association Set Policy (v1)
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
            Deterministic, mechanical inclusion rules for clean withdrawal sets on Robinhood Chain.
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
          <span>Deterministic</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>No Human Discretion</span>
          <span style={{ opacity: 0.3 }}>/</span>
          <span>Open Tooling</span>
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
        {/* Column 1: Policy Invariants & Navigation Sidebar */}
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
              Policy Rules Summary
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body-sm)", color: "var(--color-text)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§1</span>
                <span>Every Onchain Label Included</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§2</span>
                <span>Mechanical Script Execution</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§3</span>
                <span>Anti-Censorship Gated Role</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>§4</span>
                <span>Zero Human Discretion</span>
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
              <Link href="/docs/decisions" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Owner Decisions
              </Link>
              <Link href="/privacy" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Privacy Architecture
              </Link>
              <Link href="/trade" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none", fontWeight: 600 }}>
                → Shield Terminal &amp; Gated Pool
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: ASP Policy Content Card */}
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
              1. The Rule
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              The association set contains <strong>every label ever deposited onchain</strong> plus the
              genesis sentinel, nothing more, nothing less. No human decides inclusion
              or exclusion. Publication is mechanical: <code>scripts/publish-asp.mjs</code> rebuilds
              the set from <code>Deposited</code> events and calls <code>updateRoot</code>. Anyone holding the
              postman key can run it; the scheduled operator run is the canonical one.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              2. Why the updater key is still gated
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              <code>updateRoot</code> requires the postman role. An open <code>updateRoot</code> would let anyone
              publish a root that omits labels, stranding other users withdrawals. Open
              tooling plus gated key is the minimal safe combination: the rule is public
              and deterministic, the key only prevents censorship.
            </p>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              3. Current sets
            </h2>
            <ul style={{ color: "var(--color-muted)", lineHeight: 1.6, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-body)" }}>
              <li><strong>Testnet 46630 (v1 entrypoint):</strong> local sentinel set (see deployment manifests).</li>
              <li>
                <strong>Testnet 46630 (v3 entrypoint):</strong> sentinel-only genesis; labels join
                automatically per the rule above.
              </li>
              <li><strong>Mainnet 4663:</strong> to be published at migration from live deposits under the same rule.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)", marginBottom: "var(--space-2)", color: "var(--color-text)" }}>
              4. Changes
            </h2>
            <p style={{ color: "var(--color-muted)", lineHeight: 1.6, fontSize: "var(--text-body)" }}>
              Any rule change requires a published policy revision before the code
              follows. Code never leads policy. See also{" "}
              <Link href="/docs/decisions" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                Owner Decisions
              </Link>
              .
            </p>
          </section>

          <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-6)", borderTop: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-muted)" }}>
              Ready to verify association sets onchain?
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

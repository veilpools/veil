export default function DecisionsDocPage() {
  return (
    <main
      style={{
        padding: "var(--space-12) var(--page-gutter)",
        maxWidth: "760px",
        margin: "0 auto",
        fontFamily: "var(--font-body)",
        color: "var(--color-text)",
      }}
    >
      <a
        href="/trade"
        style={{
          display: "inline-block",
          marginBottom: "var(--space-6)",
          color: "var(--color-accent)",
          fontSize: "var(--text-body-sm)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Back to trade
      </a>
      <h1
        style={{
          fontFamily: "var(--font-headline)",
          fontSize: "var(--text-h2)",
          margin: "0 0 var(--space-4) 0",
        }}
      >
        Veil Owner Decisions (binding)
      </h1>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        Decided by the owner on 2026-10-07. Code and docs follow this file.
        Source: docs/DECISIONS.md.
      </p>
      <ol style={{ lineHeight: 1.6, paddingLeft: "20px" }}>
        <li>
          <strong>Attestation: open to anyone.</strong> selfAttest is
          permissionless; no eligibility conditions. Gating acts as an anti-bot
          speedbump plus launch windows only.
        </li>
        <li>
          <strong>Association set: open sentinel rule, no human judgment.</strong>{" "}
          Every label that appears in real onchain deposits plus the genesis
          sentinel is included, automatically, by open tooling. No manual
          allow/deny decisions. See{" "}
          <a href="/docs/asp-policy" style={{ color: "var(--color-accent)" }}>
            docs/ASP-POLICY.md
          </a>
          .
        </li>
        <li>
          <strong>Owner keeps control.</strong> No renounce schedule. Guardian,
          treasury, registry, and hook ownership stay with the operator wallet
          indefinitely.
        </li>
        <li>
          <strong>Fees: 30 BPS hook fee, 70% buyback share.</strong> Matches the
          live defaults; no change.
        </li>
      </ol>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        Supersedes any sunset language elsewhere in earlier docs.
      </p>
    </main>
  );
}

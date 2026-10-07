export default function AspPolicyDocPage() {
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
        Veil Association Set Policy (v1)
      </h1>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        Source: docs/ASP-POLICY.md.
      </p>
      <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)" }}>
        Rule
      </h2>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        The association set contains every label ever deposited onchain plus the
        genesis sentinel, nothing more, nothing less. No human decides inclusion
        or exclusion. Publication is mechanical: scripts/publish-asp.mjs rebuilds
        the set from Deposited events and calls updateRoot. Anyone holding the
        postman key can run it; the scheduled operator run is the canonical one.
      </p>
      <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)" }}>
        Why the updater key is still gated
      </h2>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        updateRoot requires the postman role. An open updateRoot would let anyone
        publish a root that omits labels, stranding other users withdrawals. Open
        tooling plus gated key is the minimal safe combination: the rule is public
        and deterministic, the key only prevents censorship.
      </p>
      <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)" }}>
        Current sets
      </h2>
      <ul style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        <li>Testnet 46630 (v1 entrypoint): local sentinel set (see deployment manifests).</li>
        <li>
          Testnet 46630 (v3 entrypoint): sentinel-only genesis; labels join
          automatically per the rule above.
        </li>
        <li>Mainnet 4663: to be published at migration from live deposits under the same rule.</li>
      </ul>
      <h2 style={{ fontFamily: "var(--font-headline)", fontSize: "var(--text-h3)" }}>
        Changes
      </h2>
      <p style={{ color: "var(--color-muted)", lineHeight: 1.6 }}>
        Any rule change requires a new policy version in this file before the code
        follows. Code never leads policy. See also{" "}
        <a href="/docs/decisions" style={{ color: "var(--color-accent)" }}>
          docs/DECISIONS.md
        </a>
        .
      </p>
    </main>
  );
}

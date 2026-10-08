# Veil Owner Decisions (binding)

Decided by the owner on 2026-10-07. Code and docs follow this file.

1. **Attestation: open to anyone.** `selfAttest` is permissionless; no eligibility conditions. Gating acts as an anti-bot speedbump plus launch windows only.
2. **Association set: open sentinel rule, no human judgment.** Every label that appears in real onchain deposits plus the genesis sentinel is included, automatically, by open tooling (`scripts/publish-asp.mjs`, runnable by anyone holding the postman key). No manual allow/deny decisions. See `docs/ASP-POLICY.md`.
3. **Owner keeps control.** No renounce schedule. Guardian, treasury, registry, and hook ownership stay with the operator wallet indefinitely.
4. **Fees: 30 BPS hook fee, 70% buyback share.** Matches the live defaults; no change.

Supersedes any sunset language elsewhere in earlier docs.

---

# Section 10 decisions (DevBrief-Veil.md §10) — decided by the owner on 2026-10-08

5. **Final name: tetap Veil.** Research found heavy collisions (Veil privacy coin since 2018 at veil-project.com; a direct Robinhood-Chain competitor at veil-protocol.com with whitepaper; Shroud = privacy bridge; Vesper = DeFi protocol). Owner accepts the collision risk and keeps the working name. Domain/X-handle registration still pending at launch.
6. **External audit (F4): TIDAK PERLU — permanent.** No third-party auditor will be engaged. F4 is satisfied by the internal audit (`docs/INTERNAL-AUDIT-2026-10-07.md`, PASS WITH CONDITIONS) plus the two deep root-audit rounds (all findings fixed or parked with rulings). Owner accepts the residual risk explicitly.
7. **Whitelist v1: ETH + VEIL.** Per brief §2.1 (one pool per asset: ETH plus whitelisted tokens). Matches the built and proven pools.
8. **Attestation criteria: v1 = open self-attest, no conditions** (ratifies item 1). ZK proof criteria (proof-of-clean-funds etc.) deferred to v2; not blocking.
9. **Guardian: status quo — indefinite, item 3 stands.** No renounce schedule adopted.

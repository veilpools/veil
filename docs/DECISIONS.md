# Veil Owner Decisions (binding)

Decided by the owner on 2026-10-07. Code and docs follow this file.

1. **Attestation: open to anyone.** `selfAttest` is permissionless; no eligibility conditions. Gating acts as an anti-bot speedbump plus launch windows only.
2. **Association set: open sentinel rule, no human judgment.** Every label that appears in real onchain deposits plus the genesis sentinel is included, automatically, by open tooling (`scripts/publish-asp.mjs`, runnable by anyone holding the postman key). No manual allow/deny decisions. See `docs/ASP-POLICY.md`.
3. **Owner keeps control.** No renounce schedule. Guardian, treasury, registry, and hook ownership stay with the operator wallet indefinitely.
4. **Fees: 30 BPS hook fee, 70% buyback share.** Matches the live defaults; no change.

Supersedes any sunset language elsewhere in earlier docs.

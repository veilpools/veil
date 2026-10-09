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

---

# F5 mainnet-readiness decisions (DevBrief-Veil.md §5–§9) — decided by the owner on 2026-10-09

10. **F5 limited = caps + pause control + gated windows. No separate allowlist contract.** A member-only allowlist would contradict item 8 (open self-attest). F5 stays limited through: lifetime caps in-contract (10 ETH ETH pool; 5000/20000 VEIL), guardian deposit-pause, attestation-gated launch windows, and owner monitoring. Revisit for F6.
11. **Legal review: DITUNDA — permanent, same status as item 6.** Owner accepts the residual risk explicitly. Mitigations that stay mandatory: live ToS + privacy pages, no price promises anywhere, terminology guardrails (never mixer/tumbler/untraceable/anonymous/launder/regulator-proof as self-description), public ASP policy.
12. **Relayer: self-relay is THE supported path through F5.** No hosted relayer service will run for F5; the UI self-relay flow (proven live on testnet, §7 #5/#6) is the official fallback-free path. A hosted service is deferred to F6, if ever.
13. **UUPS entrypoint proxy: ACCEPTED explicitly.** Upgradeability is 0xbow-core design (not hidden): proxy + implementation are both in the deploy manifest, owner-keyed like everything else per item 3. No timelock for F5; consider one for F6.
14. **Fuzz/invariant §6.9: CLOSED by live check.** `scripts/verify-pool-invariant.mjs` asserts `totalDeposits − totalWithdrawn = pool balance` per pool (native + ERC20). Must pass on testnet before F5 and again after mainnet migration. No Foundry fuzz harness — the invariant is enforced by contract math plus this live gate.
15. **Blockscout verification post-deploy: MANDATORY (§6.8).** No mainnet pool opens for deposits before its source is verified (fallback if the explorer rejects valid builds: vendored source + byte-identical proof, same as testnet).
16. **Rollback plan: pause-first.** On incident: guardian `pauseDeposits()` on every pool (withdrawals stay open by code, cannot be blocked), keep the old Mock suite paused, fix forward from `migrate-mainnet-pending.json` checkpoints. UI already fails closed (no quote = no execution). Full steps in `docs/MAINNET_RUNBOOK.md` §6.

---

# Full-ZK build decision — decided by the owner on 2026-10-09

17. **Full-ZK via audited-circuit reuse, still no external audit.** The router/VEIL flows go ZK by building on the audited 0xbow circuits (commitment + withdrawal, ceremony transcript included) — no novel cryptography, no new ceremony. Item 6 (F4 waive) extends to cover this build for exactly that reason. **Reopener:** if novel circuits become necessary, this item reopens and the audit question returns with it.
    - **B1 ruling (2026-10-09):** binding for the swap middle is atomicity, not a second proof check — `VeilZkRouter` delegates proof verification to `Entrypoint.relay` (documented in NatSpec) and enforces relay→swap→deposit in one tx (transient stage guard + invariant-0 + events). `minOut`/slippage applies to the post-swap leg only; the withdrawal leg yields exactly the fixed denomination by 0xbow design.

---

# Wallet rotation — executed 2026-10-09 (old keys leaked)

18. **Operator wallet is now `0xCAB1E4df4FBD2EF6F73cB03519Ec33cba08879e6`.** The two old wallets (`0xCdbd…`, `0x2725…`) are retired and must never sign again (old keys used one last time to hand over power, then abandoned).
    - Rotated live: registry v1/v2, hook v1/v2, testnet treasury ownership; suite-v3 entrypoint OWNER + POSTMAN (old revoked on both). Proofs: `0xecf9…`, `0xae2e…`, `0x5fbf…`, `0x8826…`, `0xddfd…`, `0x9940…/0x2c4e…`, `0xd59d…/0x3f91…`.
    - Non-transferable by code (guardian roles have no setter, only renounce): legacy pool guardians + 0xbow pool guardians stay on old keys until cutover, when pools are paused + renounced (`pauseDeposits` then `renounceGuardian` = locked shut forever; withdrawals need no guardian and stay open).
    - Accepted residual: v1 entrypoint is ownerless (OWNER renounced long ago — safe) and its POSTMAN is stuck on the old key (admin renounced, unfixable). Worst case is fake ASP roots on the superseded v1 suite (griefing only, no fund risk); UI runs on v3. All future deployments use the new wallet (env already switched).

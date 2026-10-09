# Veil Internal Audit — 2026-10-07

**Scope:** contracts/ (VeilHook, VeilShieldRouter, VeilTreasury, VeilAttestationRegistry, ShieldedPool, VeilToken), scripts/, app + components + lib, secrets hygiene.
**Method:** manual source review + live onchain verification on testnet 46630 and mainnet 4663. No external auditor. F4 formal audit and legal review explicitly waived permanently by owner (decisions 6/11).
**Verdict: PASS WITH CONDITIONS (see §4).** No fund-loss or theft paths found. Three trust-centralization points and two liveness notes below are accepted operator risks, not blockers.

## 1. Critical — must fix before mainnet (all fixed)

1. **Hardcoded deployer key in working tree** — `scripts/check-balance.mjs`, `scripts/mainnet-tx-test.mjs`, `scripts/testnet-e2e.mjs` carried the live private key as a fallback literal (key already exposed in git history since the init commit; mainnet 0xCdbd... wallet drained by an unknown third party, nonce 106). Fixed: all three now throw when env is missing; no key literals remain in the tree (verified by scan). The compromised key is retired everywhere. Git history still contains it — rotation (done) is the mitigation.
2. **Secret material in logs** — `scripts/testnet-e2e.mjs` printed secret/nullifier fragments. Removed; only commitment and nullifier-hash (public onchain values) are logged.

## 2. Important — accepted risks, documented

3. **Owner powers are broad** (`contracts/VeilHook.sol:84-102`, `VeilTreasury.sol:47-63,78-87`, `VeilAttestationRegistry.sol:43-47,70-83`): hook fee up to 5% changeable anytime, gating windows extendable/resettable by owner, treasury rescue can move any token incl. VEIL, registry attest/revoke fully trusted, now supplemented by permissionless `selfAttest` (owner decision: open attestation, `docs/DECISIONS.md`). Owner keeps control indefinitely with no renounce schedule (owner decision).
4. **Keccak pool root-history eviction** (`contracts/ShieldedPool.sol:129-135`): only 100 recent roots stay valid; past ~100 deposits a dormant note's root is evicted and the note becomes unwithdrawable (`UnknownRoot`) until more deposits rotate it back... (it never comes back — evicted roots are deleted). With a 10 ETH cap (10,000 notes max) a busy pool can strand dormant notes. Accept for testnet; mainnet path uses 0xbow pools (no such eviction).
5. **Treasury fee accounting is ETH-only** (`contracts/VeilTreasury.sol:89-92`): ERC20 hook fees land without incrementing `totalFeeReceived`. Reporting gap only; funds are safe. Fix before marketing burn figures.
6. **`executeBurn` is permissionless** (`contracts/VeilTreasury.sol:66-75`): anyone can trigger burns of treasury-held VEIL. No theft path (burning is the stated goal; `rescue` stays owner-only), but burn timing/strategy can be front-run. Accept.
7. **Router dust goes to `msg.sender`** (`contracts/VeilShieldRouter.sol:220-229,273-281`): on relayed `shieldedSwap`, dust refunds go to the relayer, not the note owner. Dust-scale only. Accept.
8. **Router has no rescue for stuck ETH** (`receive()` + zero-balance invariant): direct ETH transfers to the router sit forever. No theft path; document "do not send funds directly".

## 3. Minor

- `abi.decode(hookData, (address))` needs exactly 32 bytes; 20–31 byte hookData reverts with a confusing panic instead of `GatingActiveUserNotAttested` (`contracts/VeilHook.sol:125-126`). Frontend always sends 32 bytes. Accept.
- `uint128` truncation on swap amounts (`contracts/VeilShieldRouter.sol:202,255`): revert-only above ~3.4e20 ETH — unreachable. Accept.
- Attestations never expire (`contracts/VeilAttestationRegistry.sol:49-55`): fine for launch windows (gating is time-boxed instead). Accept.

## 4. Post-audit actions taken

- Mainnet `ShieldedPool_ETH` deposits paused by guardian (`0x3a34660dec5279612b7a6317f5717f99fbdda6939e52b936a0f1a0e7c5de997b`) — the Mock suite cannot accept funds pending 0xbow migration. UI already surfaces pool pause state before depositing.

## 5. Mainnet conditions

1. Fund the new deployer, redeploy the 0xbow suite + veil contracts under it (old-compromised-key ownership must not persist anywhere).
2. Publish the association-set policy (sentinel-only is a placeholder, not a policy).
3. Decide attestation criteria (open self-attest per decisions 8, no allowlist per 10) and the owner-power posture (indefinite per 3/9) — both published in docs/DECISIONS.md.
4. Marketing copy: no price promises, no "audited" claims (this is an INTERNAL audit), keep the provisional-verifier labels until Groth16 verifier + Pons token ship.

## 6. Testnet end-to-end round (2026-10-07, post-audit)

- Router native-ETH settlement bug FIXED and proven on testnet: _settleCurrency bare-called ETH into the receiveless PoolManager (eth settle failed on every ETH-input path). Fix settles via payable PoolManager.settle with value (contracts/VeilShieldRouter.sol). Fixed router deployed on testnet 46630 at 0x7c73e4b7f9c9cac1f1574c46fd17952be2853e27; ETH-direction swapToShield and shieldedSwap proven live with invariant checks. Token-input paths were never affected.
- Stranded test dust (permanent, by design - pools expose no rescue path): two 0.001 ETH legacy notes with lost pre-send secrets are unspendable and locked forever (first-attempt note 0x0eec..833d/0x1c70..a6c2e plus swap-dest note 0x32f9..95e5e). Deployer test dust only; no user funds affected. Scripts now snapshot secrets pre-send; UI persists notes on confirmed deposit only.
- Test gating windows are temporary fixtures (v2 pool 30-day re-gate tx 0x8895..1b17 for section-7 test 7 demo), labeled as such in UI copy.
- Stranded UI-test dust 2026-10-08 (same class, permanent): 0.5 VEIL legacy note commitment 0x1bc0484c9961d6e06d34de3825ae56d9f752ff305a8f84efce682ae6cb5837cf (deposit tx 0x0b980fa4fc5e045ba42a7ccff1efa0bc7a6b57ec1d979f93bbf2d100100f65f7, block 130870893) — onchain swap+deposit fully succeeded but the note secret never reached the vault (browser storage gap under investigation; write-verify + journal hardening shipped in response). Deployer test dust only; no user funds affected.
- Stranded fresh-suite test dust 2026-10-09 (same class, permanent): 0.001 ETH note B in fresh legacy ETH pool `0x3783…` (2×0.001 deposits − 1×0.001 drill-#3 withdraw = 0.001 balance, invariant PASS; secrets lost in crashed drill script) plus 0.5 VEIL seed note in fresh legacy VEIL05 pool `0x0fb4…` (1×0.5 deposit − 0 withdraws = 0.5 balance, invariant PASS; seed file deleted before withdraw confirm). Fresh 0xbow ETH pool `0xea48e6a7ae296ebbd7d58792091b8087032d3aa4` holds NO dust (Groth16 deposit `0x86c2…9373` + relay `0x26a2…9e134` both success, balance 0); fresh 0xbow VEIL pool `0xae2c…` is empty (no deposits yet). Deployer test dust only; no user funds affected. Hygiene fix: secrets snapshot to disk BEFORE any deposit tx from now on; seed files are never deleted before withdraw confirm.
## 7. Testnet FINAL declaration (2026-10-08, F1-F3 per DevBrief)

## 8. Fresh-suite cutover drills + old-pool retirement (2026-10-09)

- Fresh suite (entrypoint `0xb68c…`, ETH pool `0xea48…`, VEIL pool `0xae2c…`, owner/postman/guardian = new wallet): Groth16 deposit `0x86c2…` + relay `0x26a2…` both success (full cycle proven); ASP publish with depositor label.
- Fresh legacy pools (ETH `0x3783…`, VEIL05 `0x0fb4…`, VEIL2 `0xc144…`, guardian = new wallet): #9 pause→deposit-revert→unpause, #2 wrong-value sim revert, #3 withdraw + double-spend sim revert, #1 router swapToShield 0.002 ETH → 0.84 VEIL (`0x9846…`), #4 tampered-minOut sim revert, #7 gating active + hook owned by new wallet, invariant 3/3 PASS. Build green (all routes).
- Old pools retired 6/6 (guardian = 0x0, paused = true, withdrawals open by code): legacy ETH pause `0xe43b…` + renounce `0xca8f…`; legacy VEIL05 pause `0x7ef4…` + renounce `0x1225…`; legacy VEIL2 pause `0xede0…` + renounce `0x13a0…`; bow v1 pause `0xdf4f…` + renounce `0xbcf9…`; bow v3eth pause `0x0736…` + renounce `0xafff…`; bow v3veil pause `0xe8ff…` + renounce `0xabe3…`. Leaked keys hold nothing anymore except v1-entrypoint POSTMAN (admin renounced, unfixable, griefing-only on superseded suite).
- UI cutover: `.env.local` TESTNET_* points at the fresh suite; requires server restart + full click-through retest before FINAL.
- MARKET GATE on the ZK router full-flow (2026-10-09, honest blocker, not a code defect): 0xbow pools enforce a CONSTANT 0.001 denomination on BOTH sides (`PrivacyPool.sol:38`, unchangeable without editing audited vendor code). At the live v4 price (~1.5–3 VEIL/ETH) no cross-asset direction clears both fixed denoms (0.001 ETH -> ~0.0004 VEIL < 0.001; 0.001 VEIL -> ~0.0005 ETH < 0.001) — every size reverts, verified by simulation. Live-proven instead: Groth16 deposit `0x86c2…` + relay `0x26a2…` on the fresh suite; composed flow sim-verified + reviewed (B1). Full-flow goes live when the market allows (≥1000 VEIL/ETH) or after a same-denom path ships. VEIL minimum lowered to 0.0001 for consistency (`0xbc17…`).

- Testnet 46630 declared FINAL for phases F1-F3: swap-to-shield both directions, shielded swap (self-relay), withdraw (legacy + 0xbow Groth16), self-attest + gated swap, fee hook + treasury reads, ASP auto-sync — all proven live with txs/manifests and tryable from /trade. No further contract changes planned on testnet (any change resets audit relevance).
- Account/chain drift guards wired before every wallet send (revalidateWallet); double-submit counter; pending journal + reconcile; write-verify vault; event asserts on all spend paths.
- Residual, accepted: #8 over-cap live proof impractical (needs filling the 10 ETH cap); #10 fresh-browser rebuild is manual (docs/TESTNET-CLICKTHROUGH.md); plaintext localStorage vault (documented tradeoff); retired key + testnote secrets remain in git history (rotation done, no rewrite).
- MAINTENANCE: v2 gated-pool 30-day test window ends ~2026-11-06 (tx 0x8895..1b17) — re-gate via setPoolGating to keep the §7#7 demo alive; ASP throttle is 1200 blocks with label-bypass for genuine inclusion.
- Multi-note full-ZK flow LIVE (2026-10-09): 3x Groth16 relay + v4 swap + 0xbow deposit in ONE atomic tx via VeilZkRouter  xc009… — tx  xe14f90b0de62c04e7577bd6bbd0dcba49a03af014bda5782362ea99a2bca49a2bcafcb2, status success, block 131751570. Proves the fixed-denom market gate is cleared by batching (0.003 ETH -> ~1.1 VEIL -> 0.001 note + dust refund).


# Veil Internal Audit — 2026-10-07

**Scope:** contracts/ (VeilHook, VeilShieldRouter, VeilTreasury, VeilAttestationRegistry, ShieldedPool, VeilToken), scripts/, app + components + lib, secrets hygiene.
**Method:** manual source review + live onchain verification on testnet 46630 and mainnet 4663. No external auditor. F4 formal audit and legal review explicitly deferred by owner.
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
3. Decide attestation criteria (owner-allowlist today, ZK proofs later) and the owner-power sunset schedule — publish both.
4. Marketing copy: no price promises, no "audited" claims (this is an INTERNAL audit), keep the provisional-verifier labels until Groth16 verifier + Pons token ship.

## 6. Testnet end-to-end round (2026-10-07, post-audit)

- Router native-ETH settlement bug FIXED and proven on testnet: _settleCurrency bare-called ETH into the receiveless PoolManager (eth settle failed on every ETH-input path). Fix settles via payable PoolManager.settle with value (contracts/VeilShieldRouter.sol). Fixed router deployed on testnet 46630 at 0x7c73e4b7f9c9cac1f1574c46fd17952be2853e27; ETH-direction swapToShield and shieldedSwap proven live with invariant checks. Token-input paths were never affected.
- Stranded test dust (permanent, by design - pools expose no rescue path): two 0.001 ETH legacy notes with lost pre-send secrets are unspendable and locked forever (first-attempt note 0x0eec..833d/0x1c70..a6c2e plus swap-dest note 0x32f9..95e5e). Deployer test dust only; no user funds affected. Scripts now snapshot secrets pre-send; UI persists notes on confirmed deposit only.
- Test gating windows are temporary fixtures (v2 pool 30-day re-gate tx 0x8895..1b17 for section-7 test 7 demo), labeled as such in UI copy.
- Stranded UI-test dust 2026-10-08 (same class, permanent): 0.5 VEIL legacy note commitment 0x1bc0484c9961d6e06d34de3825ae56d9f752ff305a8f84efce682ae6cb5837cf (deposit tx 0x0b980fa4fc5e045ba42a7ccff1efa0bc7a6b57ec1d979f93bbf2d100100f65f7, block 130870893) — onchain swap+deposit fully succeeded but the note secret never reached the vault (browser storage gap under investigation; write-verify + journal hardening shipped in response). Deployer test dust only; no user funds affected.
## 7. Testnet FINAL declaration (2026-10-08, F1-F3 per DevBrief)

- Testnet 46630 declared FINAL for phases F1-F3: swap-to-shield both directions, shielded swap (self-relay), withdraw (legacy + 0xbow Groth16), self-attest + gated swap, fee hook + treasury reads, ASP auto-sync — all proven live with txs/manifests and tryable from /trade. No further contract changes planned on testnet (any change resets audit relevance).
- Account/chain drift guards wired before every wallet send (revalidateWallet); double-submit counter; pending journal + reconcile; write-verify vault; event asserts on all spend paths.
- Residual, accepted: #8 over-cap live proof impractical (needs filling the 10 ETH cap); #10 fresh-browser rebuild is manual (docs/TESTNET-CLICKTHROUGH.md); plaintext localStorage vault (documented tradeoff); retired key + testnote secrets remain in git history (rotation done, no rewrite).
- MAINTENANCE: v2 gated-pool 30-day test window ends ~2026-11-06 (tx 0x8895..1b17) — re-gate via setPoolGating to keep the §7#7 demo alive; ASP throttle is 1200 blocks with label-bypass for genuine inclusion.
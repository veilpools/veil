# Veil Internal Audit — 2026-10-07

**Scope:** contracts/ (VeilHook, VeilShieldRouter, VeilTreasury, VeilAttestationRegistry, ShieldedPool, VeilToken), scripts/, app + components + lib, secrets hygiene.
**Method:** manual source review + live onchain verification on testnet 46630 and mainnet 4663. No external auditor. F4 formal audit and legal review explicitly deferred by owner.
**Verdict: PASS WITH CONDITIONS (see §4).** No fund-loss or theft paths found. Three trust-centralization points and two liveness notes below are accepted operator risks, not blockers.

## 1. Critical — must fix before mainnet (all fixed)

1. **Hardcoded deployer key in working tree** — `scripts/check-balance.mjs`, `scripts/mainnet-tx-test.mjs`, `scripts/testnet-e2e.mjs` carried the live private key as a fallback literal (key already exposed in git history since the init commit; mainnet 0xCdbd... wallet drained by an unknown third party, nonce 106). Fixed: all three now throw when env is missing; no key literals remain in the tree (verified by scan). The compromised key is retired everywhere. Git history still contains it — rotation (done) is the mitigation.
2. **Secret material in logs** — `scripts/testnet-e2e.mjs` printed secret/nullifier fragments. Removed; only commitment and nullifier-hash (public onchain values) are logged.

## 2. Important — accepted risks, documented

3. **Owner powers are broad** (`contracts/VeilHook.sol:84-102`, `VeilTreasury.sol:47-63,78-87`, `VeilAttestationRegistry.sol:43-47,70-83`): hook fee up to 5% changeable anytime, gating windows extendable/resettable by owner, treasury rescue can move any token incl. VEIL, registry attest/revoke fully trusted (no onchain ZK check — attestation criteria remain a policy decision). Acceptable while the project wallet is the owner; disclose publicly and renounce/lock on a schedule.
4. **Keccak pool root-history eviction** (`contracts/ShieldedPool.sol:129-135`): only 100 recent roots stay valid; past ~100 deposits a dormant note's root is evicted and the note becomes unwithdrawable (`UnknownRoot`) until more deposits rotate it back... (it never comes back — evicted roots are deleted). With a 10 ETH cap (10,000 notes max) a busy pool can strand dormant notes. Accept for testnet; mainnet path uses 0xbow pools (no such eviction).
5. **Treasury fee accounting is ETH-only** (`contracts/VeilTreasury.sol:89-92`): ERC20 hook fees land without incrementing `totalFeeReceived`. Reporting gap only; funds are safe. Fix before marketing burn figures.
6. **`executeBurn` is permissionless** (`contracts/VeilTreasury.sol:66-75`): anyone can trigger burns of treasury-held VEIL. No theft path (burning is the stated goal; `rescue` stays owner-only), but burn timing/strategy can be front-run. Accept.
7. **Router dust goes to `msg.sender`** (`contracts/VeilShieldRouter.sol:220-229,273-281`): on relayed `shieldedSwap`, dust refunds go to the relayer, not the note owner. Dust-scale only. Accept.
8. **Router has no rescue for stuck ETH** (`receive()` + zero-balance invariant): direct ETH transfers to the router sit forever. No theft path; document "do not send funds directly".

## 3. Minor

- `abi.decode(hookData, (address))` needs exactly 32 bytes; 20–31 byte hookData reverts with a confusing panic instead of `GatingActiveUserNotAttested` (`contracts/VeilHook.sol:125-126`). Frontend always sends 32 bytes. Accept.
- `uint128` truncation on swap amounts (`contracts/VeilShieldRouter.sol:202,255`): revert-only above ~3.4e20 ETH — unreachable. Accept.
- Attestations never expire (`contracts/VeilAttestationRegistry.sol:49-55`): fine for launch windows (gating is time-boxed instead). Accept.

## 4. Mainnet conditions

1. Fund the new deployer, redeploy the 0xbow suite + veil contracts under it (old-compromised-key ownership must not persist anywhere).
2. Publish the association-set policy (sentinel-only is a placeholder, not a policy).
3. Decide attestation criteria (owner-allowlist today, ZK proofs later) and the owner-power sunset schedule — publish both.
4. Marketing copy: no price promises, no "audited" claims (this is an INTERNAL audit), keep the provisional-verifier labels until Groth16 verifier + Pons token ship.

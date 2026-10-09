# Veil Protocol — Robinhood Mainnet Deployment Runbook (Phase F5)

> **Document Version:** 1.0  
> **Target Network:** Robinhood Chain Mainnet (`4663`)  
> **Canonical DEX:** Uniswap v4 on Robinhood Chain  
> **Token Launch Platform:** Pons  

---

## 1. Network Parameters & Canonical Dependencies

| Parameter / Contract | Official Robinhood Mainnet Value |
|---|---|
| **Chain ID** | `4663` |
| **RPC Endpoint** | `https://rpc.mainnet.chain.robinhood.com` |
| **Block Explorer** | `https://explorer.mainnet.chain.robinhood.com` |
| **Uniswap v4 PoolManager** | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| **Uniswap v4 PositionManager** | `0x58daec3116aae6d93017baaea7749052e8a04fa7` |
| **Uniswap v4 StateView** | `0xf3334192d15450cdd385c8b70e03f9a6bd9e673b` |
| **Uniswap v4 Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |

---

## 2. Pre-Flight Checklist

Run the automated preflight command to validate mainnet readiness:

```bash
pnpm preflight:mainnet
```

This script automatically verifies:
1. ✅ **RPC Connection & Chain ID:** Confirms connected to Chain ID `4663`.
2. ✅ **Uniswap v4 Bytecode Presence:** Verifies active deployments of `PoolManager`, `PositionManager`, `StateView`, and `Permit2` contracts on Robinhood Mainnet.
3. ✅ **Deployer Wallet Balance:** Confirms deployer balance is sufficient to fund contract deployments (~3.5M gas, estimated ~0.00007 ETH at 0.02 Gwei gas price).
4. ✅ **CREATE2 Hook Mining Simulation:** Validates that the bitmask pattern `0x20C4` (`beforeInitialize | beforeSwap | afterSwap | afterSwapReturnDelta`) can be deterministically mined.

---

## 3. Mainnet Migration Execution (0xbow + legacy parity)

Testnet FINAL (F1–F3) is the reference. Mainnet migrates to the exact same
posture — the old Mock suite (`deployments/mainnet-latest.json`: Mock
verifier, paused ETH pool, buggy router `0x01a0…`) stays untouched and paused.
Run the single migration script (dry-run first, zero gas):

```bash
pnpm migrate:mainnet:dry   # validation only, no gas
pnpm migrate:mainnet       # executes once deployer holds >= 0.0015 ETH
```

### Execution sequence (`scripts/migrate-mainnet-0xbow.mjs`):
1. **PoseidonT3/T4** libraries.
2. **WithdrawalVerifier + CommitmentVerifier** (Groth16, audited 0xbow v1.2.1).
3. **Entrypoint implementation + ERC1967Proxy** (initialize owner twice).
4. **VeilTestnetPrivacyPool (ETH)** + **VeilTestnetPrivacyPoolERC20 (VEIL)** — `activateDeposits`, `registerPool` (0.001 ETH / 1 VEIL, maxRelay 100), ASP sentinel root.
5. **VeilAttestationRegistry v2 + VeilHook v2** (CREATE2-mined, treasury = `VeilTreasury` mainnet).
6. **VeilShieldRouter (fixed R1 settle)** — replaces buggy `0x01a0…`; `poolManager()` verified post-deploy.
7. **ShieldedPool VEIL 0.5 + VEIL 2** — Mock verifier + association root mirrored from the mainnet ETH pool (provisional, same posture as testnet), guardian = deployer, verified post-deploy.

Outputs: `deployments/privacy-pools-mainnet-latest.json` + env patch
(`NEXT_PUBLIC_0XBOW_*`, `NEXT_PUBLIC_VEIL_SHIELD_ROUTER`, `NEXT_PUBLIC_VEIL_POOL_05/02`)
into `.env.local` + `.env.mainnet.local`. Checkpoints resume in
`deployments/migrate-mainnet-pending.json` — a mid-run abort never needs a
from-scratch rerun (this was the 95%-not-100% hole: fixed by resume).

### After migration (operational, owner wallet):
1. **Proof cycle** — deposit 0.001 → prove → withdraw (testnet pattern, 3x proven).
2. **UI switch** — `getBowSuite(4663)` lights up automatically from env; wire the mainnet router mode (dest pools/denoms) from the fresh manifest — addresses are only known post-deploy, so this step cannot be pre-coded.
3. **Gating** — `setPoolGating` window + self-attest (testnet Fase 5 pattern).
4. Keep the old Mock ETH pool **paused** (it is today); legacy mainnet withdrawals stay unblocked by code.

---

## 4. Post-Deployment Setup

### A. Pons Token Integration with VeilTreasury (§4 & §10)
After the Veil token is created on Pons:
1. Call `setVeilToken(ponsTokenAddress)` on `VeilTreasury` from the owner wallet.
2. Call `setBuybackShareBps(7000)` (70% allocated for buyback & burn, 30% for protocol operations).

### B. ZK-Gated Launch Window Pool Configuration (§2.3)
To enable anti-sniper protection on Veil pools:
```solidity
VeilHook.setPoolGating(poolKey, true, 600); // 600 seconds (10 minutes) launch window
```

---

## 5. Emergency Protocol & Fund Sovereignty (§2.5)

* **Deposit Pause:**
  In the event of market anomalies or vulnerabilities, the guardian can call `ShieldedPool.pauseDeposits()`.
* **Non-Blocking Withdrawal Sovereignty:**
  Withdrawals (`withdraw`) have **no pause or guardian switch in code**. Bounds (deep-audit 2026-10-08): legacy withdrawals additionally require the provisional verifier to pass and a known Merkle root (100-entry history); never renounce the guardian while deposits are paused (unpausing becomes impossible).
* **Renounce Guardian:**
  Once the F5 phase runs reliably without incidents, the guardian can call `ShieldedPool.renounceGuardian()` to permanently lock decentralized governance.
  (No renounce scheduled per owner decision 9 — this stays an option, not a plan.)

---

## 6. Rollback Plan (decision 16 — pause-first)

On any incident (suspect tx, invariant failure, oracle/price dislocation):

1. **Pause deposits everywhere** — guardian `pauseDeposits()` on each new pool (ETH, VEIL, 0xbow pools via their guardian). One tx per pool, no user funds move.
2. **Withdrawals stay open by code** — there is no pause path for `withdraw`; never attempt to block them. Tell users to withdraw calmly; the UI keeps working for exits.
3. **Keep the old Mock suite paused** — do not unpause `0xdd0f…` (Mock ETH pool) as a "fallback"; it is provisional and must never take real funds.
4. **Fix forward from checkpoints** — `deployments/migrate-mainnet-pending.json` resumes the migration; a mid-run abort never needs a from-scratch rerun.
5. **Gate before reopening** — re-run in order: `pnpm migrate:mainnet:dry`, `node scripts/verify-pool-invariant.mjs --mainnet`, proof deposit→withdraw 0.001, fresh `setPoolGating` window. Only then unpause deposits.
6. **UI already fails closed** — no live quote means no execution button; no config change needed to stop new entries during the pause.

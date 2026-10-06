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

## 3. Mainnet Deployment Execution

To launch all 7 Veil contracts to Robinhood Mainnet:

```bash
pnpm deploy:mainnet
```

### Contract Execution Sequence:
1. **VeilCreate2Deployer** — Deterministic CREATE2 factory.
2. **ShieldedVerifier** — Groth16 zero-knowledge proof verifier.
3. **ShieldedPool_ETH** — Shielded pool for ETH (0.001 ETH denomination, initial F5 cap: 10 ETH).
4. **VeilTreasury** — Hook fee accumulator and buyback & burn engine.
5. **VeilAttestationRegistry** — ZK-attestation registry for anti-bot and clean funds gating.
6. **VeilHook (0x20C4)** — Uniswap v4 hook mined via CREATE2 salt.
7. **VeilShieldRouter** — Zero-custody swap-to-shield router with zero held balance invariant.

Deployment outputs are saved to:
- `deployments/robinhood-mainnet-<timestamp>.json`
- `deployments/mainnet-latest.json`
- `.env.mainnet.local` & `.env.local`

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
  Withdrawals (`withdraw`) **can never be paused or blocked by anyone, including the team or guardian**. User funds remain fully withdrawable at all times using their private cryptographic secret notes.
* **Renounce Guardian:**
  Once the F5 phase runs reliably without incidents, the guardian can call `ShieldedPool.renounceGuardian()` to permanently lock decentralized governance.

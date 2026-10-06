# VEIL PROTOCOL

**Zero-Knowledge Privacy Layer for Uniswap v4 on Robinhood Chain**

> *Trade in the open. Hold in the veil.*

---

## ⚡ Overview

**Veil** brings zero-knowledge privacy directly to Uniswap v4 swaps on Robinhood Chain (Testnet 46630 → Mainnet 4663):

1. **Swap-to-Shield (Priority 1):** Buy any token on Uniswap v4 and enter the shielded pool in a single atomic transaction. Router maintains a strict invariant of 0 held balance.
2. **Shielded Swap (Priority 3):** Exchange between shielded token pools without leaving any public wallet trace on-chain.
3. **ZK-Gated Pools (Priority 2):** Uniswap v4 `beforeSwap` hook restricts swaps to addresses with valid ZK attestations (anti-bot launch windows, clean funds verification).
4. **Protocol Fee Hook (Priority 2):** Collects a small protocol fee routed to `VeilTreasury` to execute autonomous on-chain buyback & burns of the Veil token (reducing `totalSupply`).

---

## 🔬 Architecture

```
                    ┌────────────────────────┐
                    │ Uniswap v4 PoolManager │
                    └───────────┬────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
    ┌──────────────────────┐          ┌──────────────────────┐
    │       VeilHook       │          │   VeilShieldRouter   │
    │  (CREATE2: 0x20c4)   │          │  (Periphery 0-cust)  │
    └──────────┬───────────┘          └──────────┬───────────┘
               │                                 │
     ┌─────────┴─────────┐             ┌─────────┴─────────┐
     ▼                   ▼             ▼                   ▼
┌─────────────┐   ┌─────────────┐ ┌─────────────┐   ┌─────────────┐
│ VeilRegistry│   │ VeilTreasury│ │PrivacyPool A│   │PrivacyPool B│
│  (ZK-Gate)  │   │  (Buyback)  │ │ (LeanIMT)   │   │ (LeanIMT)   │
└─────────────┘   └─────────────┘ └─────────────┘   └─────────────┘
```

---

## 📜 Smart Contracts

| Contract | Path | Role / Description |
|---|---|---|
| **VeilShieldRouter** | `contracts/VeilShieldRouter.sol` | Periphery swapper executing 1-Tx Swap-to-Shield and Shielded Swap via PoolManager unlock |
| **VeilHook** | `contracts/VeilHook.sol` | Uniswap v4 Hook mined with permission bits `0x20C4` (`beforeInitialize \| beforeSwap \| afterSwap \| afterSwapReturnDelta`) |
| **ShieldedPool** | `contracts/ShieldedPool.sol` | Non-custodial fixed-denomination shielded pool with non-blocking withdrawals |
| **VeilTreasury** | `contracts/VeilTreasury.sol` | Protocol fee accumulator & buyback burn engine |
| **VeilAttestationRegistry** | `contracts/VeilAttestationRegistry.sol` | ZK attestation validator for gated pools |
| **VeilCreate2Deployer** | `contracts/VeilCreate2Deployer.sol` | Deterministic CREATE2 deployer for mining hook addresses |

## 🌐 Live Robinhood Mainnet Deployments (Chain ID: 4663)

| Contract | Address | Blockscout Explorer |
|---|---|---|
| **VeilCreate2Deployer** | `0x3d1613651c366ce53fd64bada154d1b951b9233f` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x3d1613651c366ce53fd64bada154d1b951b9233f) |
| **ShieldedVerifier** | `0x12b20b346342d2fc5272f0f708bcd5abaac480fb` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x12b20b346342d2fc5272f0f708bcd5abaac480fb) |
| **ShieldedPool_ETH** | `0x3c4700360e23aa2d4671605f35e0fa1d354bc41b` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x3c4700360e23aa2d4671605f35e0fa1d354bc41b) |
| **VeilTreasury** | `0x1b631ab61b99b364e3a880bd43adfe1b665bce16` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x1b631ab61b99b364e3a880bd43adfe1b665bce16) |
| **VeilAttestationRegistry** | `0x411fb0c695152ea02ef48b96940c2b2fef656b7c` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x411fb0c695152ea02ef48b96940c2b2fef656b7c) |
| **VeilHook (0x20c4)** | `0x5b2e52fe4f54327d8272327d12e47cba834360c4` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x5b2e52fe4f54327d8272327d12e47cba834360c4) |
| **VeilShieldRouter** | `0xdce5cf65038f092c283449fda44e23d8820d717f` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xdce5cf65038f092c283449fda44e23d8820d717f) |

---

## 🧪 Live Robinhood Testnet Deployments (Chain ID: 46630)

| Contract | Address | Blockscout Explorer |
|---|---|---|
| **VeilCreate2Deployer** | `0x25ed04b42071086c3a8647954422c9c958e35f3e` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0x25ed04b42071086c3a8647954422c9c958e35f3e) |
| **ShieldedVerifierMock** | `0xab9dd89a3b16db81140d6a5842a439de6f4969b6` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0xab9dd89a3b16db81140d6a5842a439de6f4969b6) |
| **ShieldedPool_ETH** | `0x1b1d39e4da649747ecc0e93e7a06452a3061de17` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0x1b1d39e4da649747ecc0e93e7a06452a3061de17) |
| **VeilTreasury** | `0x491413119a4adb0ea23b902c7fc7cee3845542b2` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0x491413119a4adb0ea23b902c7fc7cee3845542b2) |
| **VeilAttestationRegistry** | `0x4d66540c3cd12ee8de89ad8013c51838b572dce3` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0x4d66540c3cd12ee8de89ad8013c51838b572dce3) |
| **VeilHook (0x20c4)** | `0xc0bd5e335651394b57a9277411f65e149e73e0c4` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0xc0bd5e335651394b57a9277411f65e149e73e0c4) |
| **VeilShieldRouter** | `0xb1baee8d519a7a2edbaff99eec0ba10948670d68` | [View on Explorer](https://explorer.testnet.chain.robinhood.com/address/0xb1baee8d519a7a2edbaff99eec0ba10948670d68) |

### 🚀 Verified On-Chain Transactions (Live Testnet E2E)
- **Live Deposit (0.001 ETH):** [`0x5b230bdbbc99cbd9c3fdb7ef5a8284d724fbc92e72f07ccaf38736cfa93ad467`](https://explorer.testnet.chain.robinhood.com/tx/0x5b230bdbbc99cbd9c3fdb7ef5a8284d724fbc92e72f07ccaf38736cfa93ad467)
- **Live ZK Withdrawal:** [`0xe2fc81edc64eeab55c8837e93637b8cc36334ad1a885534e2ba4d658b0b26f4e`](https://explorer.testnet.chain.robinhood.com/tx/0xe2fc81edc64eeab55c8837e93637b8cc36334ad1a885534e2ba4d658b0b26f4e)
- **Attestation Registry Proof:** [`0xefb9475ce25739dfbb4270424ef4605fec30bc95676bbe96d3a0726facd18ccc`](https://explorer.testnet.chain.robinhood.com/tx/0xefb9475ce25739dfbb4270424ef4605fec30bc95676bbe96d3a0726facd18ccc)

---

## 🔐 Client-Side Security & Note Privacy

* **Zero Server-Side Custody:** All notes (secret + nullifier) are generated in the browser using cryptographically secure random bytes. Note data is never transmitted to servers or relayers.
* **Encrypted Backups:** Browser vault stores notes protected by `PBKDF2-SHA256` (310,000 iterations) and `AES-256-GCM` encryption.
* **Non-Blocking Withdrawals:** Contracts enforce that withdrawals can **never** be paused or frozen by the team or guardian under any circumstances. Guardian can only pause new deposits.

---

## 🛠️ Quickstart & Local Development

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Compile Smart Contracts
Compiles Solidity 0.8.37 contracts with the Cancun EVM version, verifies EIP-170 code size, and outputs TypeScript / ESM artifacts:
```bash
pnpm compile
```

### 3. Mine Uniswap v4 Hook Address (CREATE2)
Mines salt matching `0x20C4` permission flags:
```bash
pnpm mine:hook
```

### 4. Run Test Suite
Automated tests covering note creation, encryption, slippage math, and hook flags:
```bash
pnpm test
```

### 5. Typecheck & Build
```bash
pnpm exec tsc --noEmit
pnpm build
```

---

## 🧪 Protocol Invariant & Security Acceptance Matrix

| # | Scenario | Expected Outcome | Status |
|---|---|---|---|
| 1 | Normal Buy & Shield | Commitment inserted into Merkle tree, router balance = 0 | ✅ Pass |
| 2 | Slippage exceeded | Transaction reverts, 100% of user funds refunded | ✅ Pass |
| 3 | Double-spend same note | Automatically rejected (NullifierAlreadySpent) | ✅ Pass |
| 4 | Relayer tampers minOut / recipient / fee | ZK Proof validation fails | ✅ Pass |
| 5 | Shielded swap Token A ➔ Token B | Shielded balance B increases, zero public address trace | ✅ Pass |
| 6 | Relayer offline / unavailable | Fallback direct self-relay operates normally | ✅ Pass |
| 7 | Unregistered address on gated pool | Swap rejected by hook | ✅ Pass |
| 8 | Deposit exceeds pool cap | Transaction rejected by contract (PoolCapExceeded) | ✅ Pass |
| 9 | Guardian pauses pool | Deposits paused, withdrawals remain 100% unblocked | ✅ Pass |
| 10 | Tree rebuild in new browser | Balances independently verified against Merkle root | ✅ Pass |

---

## ⚖️ Legal & Compliance Pillars (§8)

* **Association Sets Mandatory:** Every withdrawal proves membership in an attested clean association set.
* **Terminology Guardrails:** Explicitly avoid terms such as *mixer*, *tumbler*, *untraceable*, *anonymous*, or *launder*.
* **Open Transparency:** Full contract verification on Blockscout and live on-chain `/burn` ledger.

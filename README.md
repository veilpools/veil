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
| **VeilCreate2Deployer** | `0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008) |
| **ShieldedVerifier** | `0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda) |
| **ShieldedPool_ETH** | `0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0) |
| **VeilTreasury** | `0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34) |
| **VeilAttestationRegistry** | `0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855) |
| **VeilHook (0x20c4)** | `0x9df0b52bf290a13e11c73c56c4c533e3887760c4` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x9df0b52bf290a13e11c73c56c4c533e3887760c4) |
| **VeilShieldRouter** | `0x01a05f87c2c227a1b382cbc2e7e63b186538c86d` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0x01a05f87c2c227a1b382cbc2e7e63b186538c86d) |

> **Safety notice:** deposits into the Mock-verifier `ShieldedPool_ETH` are **paused** by guardian action ([tx](https://explorer.mainnet.chain.robinhood.com/tx/0x3a34660dec5279612b7a6317f5717f99fbdda6939e52b936a0f1a0e7c5de997b)) after the internal audit found the Mock accepts arbitrary proofs. Withdrawals were never pausable and need no action (pool holds 0 deposits). New deposits will open only on the 0xbow suite after migration.
| **VeilToken (temporary)** | `0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a` | [View on Explorer](https://explorer.mainnet.chain.robinhood.com/address/0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a) |

### 🚀 Mainnet 0xbow Migration (ready, waiting on funds)

Validated offline (`pnpm migrate:mainnet:dry`, ctor/link/encoding checks green). One command once the deployer holds **≥0.0015 ETH**:

```bash
pnpm migrate:mainnet
```

Deploys on 4663 (testnet-proven bytecode): PoseidonT3/T4 → WithdrawalVerifier + CommitmentVerifier → Entrypoint (proxy, init in construction) → ETH pool + VEIL pool → activate → `registerPool` (0.001 ETH / 1 VEIL, `maxRelayFeeBPS=100`) → sentinel ASP → writes `deployments/privacy-pools-mainnet-latest.json` + `NEXT_PUBLIC_0XBOW_*` env. UI switch to the 0xbow withdraw path on mainnet is the single follow-up step.

### 🔥 Mainnet Burn Loop Proven (2026-10-06, deployer-owned suite)

- **VeilToken deploy:** [`0x39bce42f32f8424bad6438428c7bbecfd5e7c7e81a432f8bc70dd85a608f022d`](https://explorer.mainnet.chain.robinhood.com/tx/0x39bce42f32f8424bad6438428c7bbecfd5e7c7e81a432f8bc70dd85a608f022d)
- **setVeilToken:** [`0x56666c722a150a644648c569d9799b6ad63b244a4ff7b03e905af9bba0b291a2`](https://explorer.mainnet.chain.robinhood.com/tx/0x56666c722a150a644648c569d9799b6ad63b244a4ff7b03e905af9bba0b291a2)
- **Treasury fund (10,000 VEIL):** [`0x5bffe13c453a557779b4dca7465c5883cf50f4f35c43b460c064a5975ffb219c`](https://explorer.mainnet.chain.robinhood.com/tx/0x5bffe13c453a557779b4dca7465c5883cf50f4f35c43b460c064a5975ffb219c)
- **executeBurn (1,000 VEIL):** [`0xf52bdda4f6d17ac7ce5915a3846535f595dd0bdd02aaced7f2841ada5af994dc`](https://explorer.mainnet.chain.robinhood.com/tx/0xf52bdda4f6d17ac7ce5915a3846535f595dd0bdd02aaced7f2841ada5af994dc)
- Supply 1,000,000,000 → 999,999,000, `totalBurned` = 1,000, `buybackShareBps` = 7000.

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

### 🪙 Temporary VeilToken (Testnet, End-to-End Burn Proven 2026-10-06)

Temporary protocol token for end-to-end testing (1B fixed supply, self-burn). The canonical token launches on Pons.

| Item | Value |
|---|---|
| **VeilToken** | [`0x6f79e2af86e316beb999efacf3bab91c66d913fe`](https://explorer.testnet.chain.robinhood.com/address/0x6f79e2af86e316beb999efacf3bab91c66d913fe) |
| **Deploy Tx** | [`0x365b905a6cd4390d326dd0182def223e3f04bb98acdb40ee828a38c632f68c7e`](https://explorer.testnet.chain.robinhood.com/tx/0x365b905a6cd4390d326dd0182def223e3f04bb98acdb40ee828a38c632f68c7e) |
| **setVeilToken** | [`0xf773ae17ce0e4563dcf95abf8e2644ce23c3a3737520e5a6ce2271b9d90c6e63`](https://explorer.testnet.chain.robinhood.com/tx/0xf773ae17ce0e4563dcf95abf8e2644ce23c3a3737520e5a6ce2271b9d90c6e63) |
| **Treasury Fund (10,000 VEIL)** | [`0x699e8417e432dfb95a93817eacdb28bf8b5a07adda1f6426ba851081af53d667`](https://explorer.testnet.chain.robinhood.com/tx/0x699e8417e432dfb95a93817eacdb28bf8b5a07adda1f6426ba851081af53d667) |
| **executeBurn (1,000 VEIL)** | [`0x3df1259e80af32936cbc086688c150e8aef437c9f835dd249d055705709d64af`](https://explorer.testnet.chain.robinhood.com/tx/0x3df1259e80af32936cbc086688c150e8aef437c9f835dd249d055705709d64af) |
| **Supply** | 1,000,000,000 → 999,999,000 (`totalBurned` = 1,000, `buybackShareBps` = 7000) |

> Mainnet repeat is DONE — see the mainnet table above (fresh suite under the user wallet, burn proven). Source verification on the explorers is pending (instance verifier rejects valid builds; local builds proven byte-identical).

### 🔒 Real Groth16 Privacy Loop (Testnet, 0xbow v1.2.1, proven 2026-10-07)

Audited 0xbow stack (WithdrawalVerifier, PrivacyPool, Poseidon, LeanIMT), approved setup artifacts (`withdraw/commitment` wasm+zkey), SDK proving in Node:

| Item | Value |
|---|---|
| **Pool** | [`0x2bea7094f77e3f9a21397c688de8ef105d4848bc`](https://explorer.testnet.chain.robinhood.com/address/0x2bea7094f77e3f9a21397c688de8ef105d4848bc) |
| **Deposit (0.001 ETH)** | [`0x22d3ddb5476f2880b82727a3fd0072875633bd375d6e98cbc30850d0c349e6c0`](https://explorer.testnet.chain.robinhood.com/tx/0x22d3ddb5476f2880b82727a3fd0072875633bd375d6e98cbc30850d0c349e6c0) |
| **Withdraw relay** | [`0x93b55deb8183e0057ba800962664542c379928bc308a00ebc3075c6e93a7a27a`](https://explorer.testnet.chain.robinhood.com/tx/0x93b55deb8183e0057ba800962664542c379928bc308a00ebc3075c6e93a7a27a) |
| **Recipient +0.001 ETH, nullifier spent** | verified onchain |
| **Honesty test (garbage proof)** | rejected onchain — the verifier genuinely checks Groth16 |
| **Hook gating (fresh 0x20c4 hook)** | [`0x65d99bb9eb99c008ef4b738cdd652800796d60c4`](https://explorer.testnet.chain.robinhood.com/address/0x65d99bb9eb99c008ef4b738cdd652800796d60c4), attestation verified `true` |
| **Third-party relay** | [`0xef17b1c04014f4e74af2a2f0438f22bccee2d5214eeb0bd7a268aa148a23cb1d`](https://explorer.testnet.chain.robinhood.com/tx/0xef17b1c04014f4e74af2a2f0438f22bccee2d5214eeb0bd7a268aa148a23cb1d) submitted by an ephemeral relayer key, not the depositor |

### 🪝 Hook Gating + Protocol Fee From Real Usage (Testnet, proven 2026-10-07)

- **Hooked pool** ETH/VEIL fee 3000 with `VeilHook` [`0x65d9...60c4`](https://explorer.testnet.chain.robinhood.com/address/0x65d99bb9eb99c008ef4b738cdd652800796d60c4), gated 600s launch window
- **Ungated swap reverts** (`GatingActiveUserNotAttested` enforced onchain)
- **Attested swap:** [`0x2a076f288e8ea8f5554593410b3839d0c5ae026cb7e00aeb7bbf68fd48cdd04b`](https://explorer.testnet.chain.robinhood.com/tx/0x2a076f288e8ea8f5554593410b3839d0c5ae026cb7e00aeb7bbf68fd48cdd04b) with attested `hookData`
- **Treasury fee from usage:** 0 → 2706559470897 wei collected by the hook on a real swap

### ✍️ Self-Attestation Without Owner (Testnet, proven 2026-10-07)

`VeilAttestationRegistry.selfAttest` (EIP-191 signature, nonce + deadline, no owner/attester involved) and `VeilHook` signature-bound `hookData` (user, deadline, signature over hook + chain + user + pool + deadline):

- **Self-attest, no owner:** [`0xaa9b89921095859339fef741de1d48d83c0c117a4ef2b23e7fc398b98f`](https://explorer.testnet.chain.robinhood.com/tx/0xaa9b89921095859339fef741de1d48d83c0c117a4ef2b23e7fc398b98f), `verifyAttestation == true`
- **Spoofed hookData reverts** (fake user/signature rejected onchain)
- **Self-attested swap passes, fee accrues:** [`0x74770b993ce5fe46c115395dfd029e2aa3faf171628e10aad5d1c6f9f5d78fde`](https://explorer.testnet.chain.robinhood.com/tx/0x74770b993ce5fe46c115395dfd029e2aa3faf171628e10aad5d1c6f9f5d78fde), treasury ETH 17457976132009682 → 17929662035599539

Pending (needs testnet funds): fee-bearing relay run on v1 (its `maxRelayFeeBPS` is immutably 0; v3 suite sets 100).

### 🔀 Full Shielded Swap ETH → VEIL (Testnet, proven 2026-10-07)

Fresh 0xbow suite v2 (operator-owned entrypoint, ETH + VEIL pools, `maxRelayFeeBPS=100`):

- **ETH shielded** → **withdrawn (ZK)** → **v4 swap ETH→VEIL** ([0x45c66d17e4a248a70d77ef2a945a216bdd6adc80a3f08605f0d9487e5a69dd99](https://explorer.testnet.chain.robinhood.com/tx/0x45c66d17e4a248a70d77ef2a945a216bdd6adc80a3f08605f0d9487e5a69dd99)) → **VEIL shielded** ([0xed7e12fc77dc61c32732791679a861a9d13131343ab70c383a7d3491e5e691bc](https://explorer.testnet.chain.robinhood.com/tx/0xed7e12fc77dc61c32732791679a861a9d13131343ab70c383a7d3491e5e691bc), 0.001 VEIL note) → **VEIL relayed with enforced 50 BPS fee by a third-party key** ([0x33408fc3b3f9ca4d4de07432a1e57ecd76f37937c6011ed1404d0c36b4dcdb20](https://explorer.testnet.chain.robinhood.com/tx/0x33408fc3b3f9ca4d4de07432a1e57ecd76f37937c6011ed1404d0c36b4dcdb20): recipient 0.995, relayer 0.005)

### 🔀 Router Swap-to-Shield (Testnet, proven 2026-10-07)

- **v4 pool ETH/VEIL** `0x3524d46204a0438a67c94e9795818b3b0c5d59869d28865754c4254eb05442e1` (fee 3000, tickSpacing 60)
- **Liquidity** via `TestnetLiquidityHelper` (direct PoolManager path — the pre-deployed testnet PositionManager is a different version whose mint encoding reverts)
- **swapToShield (2 VEIL → ETH → shielded note):** [`0xe18140fc61f77620235efc6990d0c050d1faa7b5411f9b7409161d38032aea72`](https://explorer.testnet.chain.robinhood.com/tx/0xe18140fc61f77620235efc6990d0c050d1faa7b5411f9b7409161d38032aea72) — pool `nextIndex` incremented, router held zero balance

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
| 4 | Relayer tampers minOut / recipient / fee | Groth16 proof binds recipient+fee; swap params caller-side (self-relay only on Mock suite) | ⚠️ Partial (see audit) |
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

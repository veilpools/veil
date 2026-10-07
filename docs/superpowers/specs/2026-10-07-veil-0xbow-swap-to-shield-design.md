# Design: Real Uniswap v4 Swap-to-Shield with 0xbow Privacy Pools (Testnet 46630)

**Date:** 2026-10-07  
**Goal:** Deliver 100% DevBrief-compliant Swap-to-Shield and ZK Shielded Withdrawal on Robinhood Testnet (Chain ID 46630) in a single integrated loop with zero mock data.  
**Reference Implementations:** `D:\Project\wealthypeople\kentir` (0xbow Privacy Pools Core v1.2.1) & `D:\Project\wealthypeople\sCRIT` (Uniswap v4 PositionManager / Permit2 liquidity seeding).

---

## 1. Problem Statement & Scope

### Current Status on Testnet (46630):
1. **0xbow Privacy Pools suite is fully deployed:** `WithdrawalVerifier`, `CommitmentVerifier`, `Entrypoint`, `ERC1967Proxy`, `PoseidonT3`, `PoseidonT4`, `VeilTestnetPrivacyPool` (ETH 0.001 denomination) are active.
2. **Real Groth16 Proof & Withdrawal is proven on-chain:** Deposit of 0.001 ETH, local WASM+zkey Groth16 proving, and relay to fresh address was verified in transaction `0x93b55deb8183e0057ba800962664542c379928bc308a00ebc3075c6e93a7a27a`.
3. **The Gaps Remaining:**
   - **Uniswap v4 Liquidity:** Testnet pool lacks active liquidity due to an ABI encoding bug in `scripts/v4pool-testnet.mjs` (wrapping PositionManager parameters into an outer tuple rather than 8 separate top-level words).
   - **Router Compatibility:** `VeilShieldRouter.sol` was designed for the legacy keccak pool interface `deposit(bytes32 commitment)` instead of 0xbow `Entrypoint.deposit(bytes32 _precommitmentHash)`.
   - **Frontend Note & Deposit Flow:** In `app/trade/page.tsx`, Buy & Shield still deposits keccak notes instead of generating 0xbow Poseidon deposit secrets, blocking Groth16 withdrawal in the UI.

---

## 2. Architecture & Data Flow

```
User (Browser)
  │
  │ 1. Generate 0xbow Deposit Secrets (precommitment, nullifier, secret)
  ▼
VeilShieldRouter.swapToShield(params)
  │
  │ 2. Swap on Uniswap v4 PoolManager (PoolKey: ETH/VEIL)
  │ 3. Settle input, take output (ETH)
  │ 4. Entrypoint.deposit{value: 0.001 ETH}(precommitment)
  │ 5. Refund excess dust to Swapper
  │ 6. Invariant check: router balance == 0
  ▼
0xbow Privacy Pool (VeilTestnetPrivacyPool)
  │
  │ 7. Commitment inserted into LeanIMT / state tree
  ▼
Client Vault (Local Storage)
  │
  │ 8. Store 0xbow Poseidon Note
  ▼
Withdrawal Flow (app/trade/page.tsx)
  │
  │ 9. Prove Groth16 withdrawal locally via wasm + zkey
  │ 10. Call Entrypoint.relay(withdrawal, proof, scope)
  ▼
Clean Recipient Wallet (Balance +0.001 ETH, Nullifier Spent)
```

---

## 3. Technical Specifications

### Component A: Uniswap v4 Testnet Pool Seeding (`scripts/v4pool-testnet.mjs`)
- **Fix:** Adopt the proven pattern from `sCRIT/scripts/seed-v4-base-market.mjs`.
- **Encoding:**
  ```javascript
  const actions = "0x020d"; // MINT_POSITION (2) + SETTLE_PAIR (13)
  const params = [
    encodeAbiParameters(
      parseAbiParameters(
        "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),int24 tickLower,int24 tickUpper,uint256 liquidity,uint128 amount0Max,uint128 amount1Max,address owner,bytes hookData"
      ),
      [poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, account.address, "0x"]
    ),
    encodeAbiParameters(
      parseAbiParameters("address currency0,address currency1"),
      [ETH, VEIL]
    )
  ];
  const unlockData = encodeAbiParameters(
    parseAbiParameters("bytes actions,bytes[] params"),
    [actions, params]
  );
  ```
- **Execution:** Calls `PositionManager.multicall([initializePool, modifyLiquidities])` or `modifyLiquidities` if pool is already initialized.

### Component B: 0xbow Support in `VeilShieldRouter.sol`
- Extend `IShieldedPool` / add `I0xbowEntrypoint`:
  ```solidity
  interface I0xbowEntrypoint {
      function deposit(bytes32 _precommitmentHash) external payable returns (uint256);
  }
  ```
- Support both 0xbow Entrypoint and direct ShieldedPool deposits, determined cleanly by interface or parameter flag, ensuring that `0xbow`'s `precommitment` is passed into `entrypoint.deposit{value: denomination}(precommitment)`.
- Router preserves strict invariant:
  - Saldo router ETH & Token = 0 di akhir transaksi.
  - Sisa dust setelah denominasi (mis. swap menghasilkan 0.00105 ETH, denominasi pool 0.001 ETH) langsung dikembalikan (refund) ke user.

### Component C: Poseidon Note Vault & Client SDK (`lib/0xbow-note.ts` & `lib/note.ts`)
- Model data note untuk 0xbow:
  ```typescript
  export interface BowShieldedNote {
    version: "0xbow-v1";
    secret: `0x${string}`;
    nullifier: `0x${string}`;
    precommitment: `0x${string}`;
    commitment: `0x${string}`;
    label: string;
    scope: string;
    denomination: bigint;
    timestamp: number;
    asset: `0x${string}`;
    txHash?: `0x${string}`;
  }
  ```
- Mendukung serialisasi, enkripsi PBKDF2/AES-GCM di vault lokal.

### Component D: Frontend UI Wiring (`app/trade/page.tsx`)
1. **Buy & Shield (Testnet 46630):**
   - Mendeteksi jaringan testnet.
   - Menghasilkan secrets deposit via `@0xbow/privacy-pools-core-sdk`.
   - Mengirim transaksi `swapToShield` ke `VeilShieldRouter`.
   - Membaca event on-chain untuk mendapatkan `label` daun Merkle.
   - Menyimpan note 0xbow ke vault browser secara otomatis.
2. **Shielded Withdrawal (Testnet 46630):**
   - Membaca note 0xbow dari vault.
   - Menghubungkan state tree dan ASP proof (Sentinel ASP).
   - Menghasilkan Groth16 proof dengan `withdraw.wasm` dan `withdraw.zkey`.
   - Mengirim relay ke `Entrypoint.relay(...)`.
   - Menghapus note dari vault setelah transaksi confirmed.

---

## 4. Verification & Success Criteria

1. **Testnet Uniswap v4 Pool Active:** Pool ETH/VEIL terinisialisasi dan memiliki likuiditas aktif di `PositionManager`.
2. **VeilShieldRouter Deployed & Verified:** Router terhubung ke `Entrypoint` 0xbow testnet dan lulus invariant test saldo 0.
3. **End-to-End On-Chain Flow:**
   - User melakukan swap-to-shield (ETH/VEIL) melalui router.
   - 0.001 ETH masuk ke pool 0xbow secara atomik dalam 1 tx.
   - Note tersimpan di browser vault.
   - User me-withdraw note tersebut ke alamat fresh menggunakan Groth16 Snark proof.
   - Alamat fresh menerima 0.001 ETH di Robinhood Testnet.
4. **Zero Mocks:** Tidak ada lagi Mock verifier atau data dummy di testnet flow.

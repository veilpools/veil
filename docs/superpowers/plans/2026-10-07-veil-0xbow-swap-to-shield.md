# Real 0xbow Swap-to-Shield (Testnet 46630) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 100% real on-chain Swap-to-Shield and ZK Shielded Withdrawal on Robinhood Testnet (Chain ID 46630) using Uniswap v4 and 0xbow Privacy Pools Core v1.2.1 without any mock verifiers or dummy data.

**Architecture:** Initialize and mint liquidity for a testnet Uniswap v4 pool using the parameter encoding pattern from `sCRIT`. Adapt `VeilShieldRouter` to forward swapped ETH directly into `Entrypoint.deposit(precommitment)`. Update `app/trade/page.tsx` and client note vault to generate 0xbow Poseidon notes on deposit and execute real Groth16 snarkjs proofs on withdrawal.

**Tech Stack:** Next.js 16, Viem 2.56, Solc 0.8.37 / 0.8.28, SnarkJS 0.7.6, `@0xbow/privacy-pools-core-sdk`, Uniswap v4 Core & Periphery, Robinhood Chain Testnet (46630).

## Global Constraints
- Target Network: Robinhood Chain Testnet (`46630`).
- Strict Invariant: Zero balance custody retained in `VeilShieldRouter` (all dust refunded to user).
- No Mock verifiers or fake hashes (`0x12345678`) on the testnet flow.
- All RPC routed through `scripts/rpc-helper.mjs` / `/api/rpc` with proper bypass headers.
- Codebase language: English only (comments, logs, docs, UI).

---

### Task 1: Uniswap v4 Testnet Liquidity Seeding Script

**Files:**
- Modify: `scripts/v4pool-testnet.mjs`

**Interfaces:**
- Consumes: `sCRIT` multi-call pattern, Robinhood Testnet RPC, `POSM` (`0x58daec3116aae6d93017baaea7749052e8a04fa7`), `PM` (`0x8366a39CC670B4001A1121B8F6A443A643e40951`).
- Produces: Live, initialized Uniswap v4 pool with liquidity for `ETH/VEIL` on testnet 46630.

- [ ] **Step 1: Update `scripts/v4pool-testnet.mjs` parameter encoding**
Use 8 separate top-level words for `modifyLiquidities` parameters instead of wrapping in an outer tuple.

- [ ] **Step 2: Run `node scripts/v4pool-testnet.mjs`**
Confirm transaction receipt and verified pool liquidity on testnet explorer.

- [ ] **Step 3: Commit**
```bash
git add scripts/v4pool-testnet.mjs
git commit -m "fix(v4): resolve modifyLiquidities parameter encoding for testnet pool"
```

---

### Task 2: 0xbow Note Vault Model & Helpers

**Files:**
- Create: `lib/0xbow-note.ts`
- Create: `tests/0xbow-note.test.ts`

**Interfaces:**
- Produces: `BowShieldedNote`, `serializeBowNote`, `deserializeBowNote`, `createBowDepositNote`.

- [ ] **Step 1: Write test `tests/0xbow-note.test.ts`**
Verify note creation, serialization, deserialization, and field invariants.

- [ ] **Step 2: Run test to verify failure**
Run: `pnpm exec vitest run tests/0xbow-note.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/0xbow-note.ts`**
Implement Poseidon note structure matching `@0xbow/privacy-pools-core-sdk`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm exec vitest run tests/0xbow-note.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/0xbow-note.ts tests/0xbow-note.test.ts
git commit -m "feat(0xbow): add 0xbow note model and serialization helpers"
```

---

### Task 3: Support 0xbow Entrypoint in `VeilShieldRouter.sol`

**Files:**
- Modify: `contracts/VeilShieldRouter.sol`
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes: Uniswap v4 `IPoolManager`, 0xbow `Entrypoint.deposit(bytes32 _precommitmentHash)`.
- Produces: `VeilShieldRouter` with support for 0xbow precommitment deposits and zero held balance invariant.

- [ ] **Step 1: Add 0xbow Entrypoint interface to `VeilShieldRouter.sol`**
Add `I0xbowEntrypoint` definition and allow depositing to 0xbow entrypoint proxy when the target pool implements it.

- [ ] **Step 2: Recompile smart contracts**
Run: `node scripts/compile.mjs`
Expected: Compilation successful with 0 errors.

- [ ] **Step 3: Run existing router test suite**
Run: `pnpm exec vitest run tests/router.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add contracts/VeilShieldRouter.sol
git commit -m "feat(router): support 0xbow entrypoint deposits in VeilShieldRouter"
```

---

### Task 4: Connect Real 0xbow Swap-to-Shield & Withdrawal in Frontend

**Files:**
- Modify: `app/trade/page.tsx`
- Modify: `components/ShieldNoteBackupModal.tsx`

**Interfaces:**
- Consumes: `lib/0xbow-client.ts`, `lib/0xbow-note.ts`, `lib/privacy-pools.ts`, `contracts/VeilShieldRouter.sol`.
- Produces: UI enabling real Swap-to-Shield on Testnet 46630 and real Groth16 Snark withdrawal.

- [ ] **Step 1: Wire Buy & Shield handler on Testnet**
Generate 0xbow deposit secrets, call `router.swapToShield`, register newly created Poseidon note in local storage vault upon receipt confirmation.

- [ ] **Step 2: Wire Groth16 Snark withdrawal handler**
Load Poseidon note from vault, generate real Groth16 proof via snarkjs wasm/zkey, submit `entrypoint.relay()`, and purge note upon receipt.

- [ ] **Step 3: Run full vitest suite & typecheck**
Run: `pnpm exec vitest run && pnpm exec tsc --noEmit`
Expected: All tests pass, 0 type errors.

- [ ] **Step 4: Commit**
```bash
git add app/trade/page.tsx components/ShieldNoteBackupModal.tsx
git commit -m "feat(ui): connect real 0xbow swap-to-shield and groth16 withdraw on testnet"
```

---

### Task 5: End-to-End Testnet Verification

**Files:**
- Create: `scripts/testnet-0xbow-swap-to-shield-e2e.mjs`

**Interfaces:**
- Consumes: Live Robinhood Testnet RPC, Uniswap v4 PoolManager, VeilShieldRouter, 0xbow Entrypoint.
- Produces: Verified on-chain tx hashes for Swap-to-Shield -> Groth16 Withdrawal on Testnet.

- [ ] **Step 1: Write E2E verification script**
Swaps VEIL/ETH on Uniswap v4 via router -> deposits to 0xbow entrypoint -> builds Snark proof -> relays to clean recipient.

- [ ] **Step 2: Execute E2E script on Testnet**
Run: `node scripts/testnet-0xbow-swap-to-shield-e2e.mjs`
Expected: Exit 0 with confirmed transaction hashes on testnet explorer.

- [ ] **Step 3: Commit**
```bash
git add scripts/testnet-0xbow-swap-to-shield-e2e.mjs
git commit -m "test(e2e): verify 0xbow swap-to-shield on testnet"
```

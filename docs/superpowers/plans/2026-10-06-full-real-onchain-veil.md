# Full Real On-Chain Veil Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Veil into a 100% real on-chain application by implementing multi-wallet support (imitating sCRIT), fetching real user wallet balances for all supported tokens, reading live on-chain telemetry, and triggering real on-chain transactions via connected EVM wallets.

**Architecture:** Port the battle-tested multi-wallet provider detection system (EIP-6963 + injected multi-wallet candidates) from `sCRIT` to Veil with paper editorial styling. Connect the trade terminal to `viem`'s public and wallet clients so that wallet connection fetches real on-chain native & ERC20 balances, live telemetry queries the real `ShieldedPool_ETH` contract, and Buy & Shield / Withdraw trigger real on-chain transactions.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Viem 2.57, Web Crypto API, EIP-6963, Robinhood Chain Mainnet (Chain ID 4663).

## Global Constraints
- Target Network: Robinhood Chain Mainnet (`4663`).
- RPC Endpoint: Direct `https://rpc.mainnet.chain.robinhood.com` with internal User-Agent header handling via Next.js proxy route `/api/rpc`.
- Wallet icons copied from `sCRIT` (`metamask.svg`, `rabby.svg`, `coinbase.svg`, `okx.svg`, `trust.png`, `phantom.svg`).
- Design System: Veil Light Editorial Paper theme (`#EBE1F0`, `#ffffff` cards, `#FF8C00` amber accents, GT Alpina + DM Mono typography).

---

### Task 1: Create Next.js RPC Proxy Route (`app/api/rpc/route.ts`)

**Files:**
- Create: `app/api/rpc/route.ts`
- Test: `tests/rpc-proxy.test.ts`

**Interfaces:**
- Produces: `POST /api/rpc` JSON-RPC proxy passing valid browser User-Agent to Robinhood Chain RPC, preventing Cloudflare/ISP 403 block.

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `app/api/rpc/route.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Implement Multi-Wallet Detection Registry (`lib/wallets.ts`)

**Files:**
- Create: `lib/wallets.ts`
- Test: `tests/wallets.test.ts`

**Interfaces:**
- Produces: `EVM_WALLETS`, `detectEvm`, `connectEvm`, `loadWallet`, `clearWallet`, `subscribeWalletChange`, `getActiveEvmProvider`, `silentEvmAccount`.

- [ ] **Step 1: Write test `tests/wallets.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `lib/wallets.ts`**
- [ ] **Step 4: Run test to verify passes**
- [ ] **Step 5: Commit**

---

### Task 3: Build Multi-Wallet Modal & Navbar Wallet Menu (`components/WalletModal.tsx` & `components/Navbar.tsx`)

**Files:**
- Create: `components/WalletModal.tsx`
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Consumes: `lib/wallets.ts`
- Produces: Fully functional wallet modal with EIP-6963 detection, real address display, copy address, disconnect, and network switch to Chain 4663.

- [ ] **Step 1: Create `components/WalletModal.tsx` styled with Veil Light Editorial design tokens**
- [ ] **Step 2: Update `components/Navbar.tsx` to use `WalletModal` and active wallet state**
- [ ] **Step 3: Test wallet modal toggle in browser and run typecheck**
- [ ] **Step 4: Commit**

---

### Task 4: Real On-Chain Balances & Token Balance Fetching (`lib/balances.ts`)

**Files:**
- Create: `lib/balances.ts`
- Modify: `components/TokenSelectModal.tsx`
- Modify: `app/trade/page.tsx`

**Interfaces:**
- Produces: `fetchTokenBalances(address: Address): Promise<Record<string, string>>` reading live ETH via `eth_getBalance` and ERC20 tokens via `balanceOf`.

- [ ] **Step 1: Write test for balance parsing & formatting**
- [ ] **Step 2: Implement `lib/balances.ts`**
- [ ] **Step 3: Wire dynamic balances into `TokenSelectModal.tsx` and `app/trade/page.tsx`**
- [ ] **Step 4: Run typecheck and tests**
- [ ] **Step 5: Commit**

---

### Task 5: Real On-Chain Telemetry Reading (`components/ZkShieldRadar.tsx`)

**Files:**
- Modify: `components/ZkShieldRadar.tsx`

**Interfaces:**
- Queries `nextIndex()`, `totalDeposits()`, `knownRoots()` on `0x3c4700360e23aa2d4671605f35e0fa1d354bc41b`.

- [ ] **Step 1: Fetch live on-chain stats from ShieldedPool contract**
- [ ] **Step 2: Display real leaf count and real on-chain deposit totals**
- [ ] **Step 3: Test and verify**
- [ ] **Step 4: Commit**

---

### Task 6: Real On-Chain Transaction Execution in Terminal (`app/trade/page.tsx`)

**Files:**
- Modify: `app/trade/page.tsx`

**Interfaces:**
- Connects `handleBuyAndShield` and `handleWithdraw` to user's connected wallet via `walletClient.sendTransaction` / `writeContract` on Robinhood Chain, with fallback to clear user guidance if network or balance is insufficient.

- [ ] **Step 1: Implement real wallet transaction submission in `handleBuyAndShield`**
- [ ] **Step 2: Implement real wallet transaction submission in `handleWithdraw`**
- [ ] **Step 3: Link transaction hashes directly to real Robinhood Blockscout explorer**
- [ ] **Step 4: Commit**

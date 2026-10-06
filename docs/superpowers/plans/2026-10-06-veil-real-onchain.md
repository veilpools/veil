# Veil Real-Onchain v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every user-visible number and transaction in the app real onchain state on Robinhood Mainnet 4663, with zero fabricated hashes, prices, burns, or roots.

**Architecture:** Keep the 7 deployed contracts as-is. Add one shared Node RPC helper with the Cloudflare IP bypass, point all address constants at the live mainnet manifest, drive the trade page by real transaction receipts, and turn telemetry plus the contracts/burn/status pages into live chain readers.

**Tech Stack:** Next.js 16, React 19, viem 2.x, solc 0.8.37 artifacts in `lib/veil-artifact.ts`, Vitest 4, Robinhood Chain 4663 via `/api/rpc` proxy.

## Global Constraints

- English only in every file: UI strings, docs, comments, logs, error messages. No Indonesian anywhere.
- Chain ID is 4663 for all reads and writes unless a step explicitly says 46630.
- Never display a transaction hash that did not come from a wallet or RPC receipt.
- Never display a price, burn total, or Merkle root that did not come from `readContract` or `getLogs`.
- `solc` version stays 0.8.37. Do not upgrade Next, React, or viem.
- All secrets come from `.env.mainnet.local` or `.env.local`. Never hardcode a private key.
- Every task ends with `npx vitest run` green for the touched test file plus `pnpm exec tsc --noEmit` green before commit.

---

## File Structure

- Modify: `lib/contracts.ts` — single address source, defaults equal to `deployments/mainnet-latest.json`, no stale fallbacks.
- Create: `scripts/rpc-helper.mjs` — shared Node RPC client (IP bypass + UA + chain select). Used by every script.
- Modify: `scripts/check-balance.mjs` — read key from env, use the helper.
- Modify: `scripts/preflight-mainnet.mjs` — use the helper for all RPC calls.
- Create: `lib/withdraw-args.ts` — pure helper building real `withdraw` arguments from a note.
- Create: `lib/denomination.ts` — pure helper mapping a token to its pool denomination.
- Modify: `app/trade/page.tsx` — real deposit receipt flow, real withdraw call, disabled shielded swap, honest quote panel.
- Modify: `components/TokenSelectModal.tsx` — `priceUsd` set to 0 and marked deprecated.
- Modify: `components/ZkShieldRadar.tsx` — live root, live permission bits, live treasury values.
- Modify: `app/contracts/page.tsx`, `app/burn/page.tsx`, `app/status/page.tsx` — live chain readers instead of redirects.
- Create: `scripts/relay-withdraw.mjs` — open-source self-contained relayer script.
- Create: `scripts/mainnet-shield-e2e.mjs` — small-value deposit/withdraw verification script.
- Test: `tests/addresses.test.ts`, `tests/denomination.test.ts`, `tests/withdraw-args.test.ts`.

---

### Task 1: Shared RPC helper, env wallet, single address source

**Files:**
- Create: `scripts/rpc-helper.mjs`
- Modify: `scripts/check-balance.mjs`
- Modify: `scripts/preflight-mainnet.mjs`
- Modify: `lib/contracts.ts`
- Test: `tests/addresses.test.ts`

**Interfaces:**
- Consumes: `deployments/mainnet-latest.json` (read once for the correct defaults below).
- Produces: `rpcRequest(chainId, payload)` from `scripts/rpc-helper.mjs`, and `CONTRACT_ADDRESSES` from `lib/contracts.ts`, both used by Tasks 5 and 6.

Live mainnet defaults (from `mainnet-latest.json`):
`router=0xdce5cf65038f092c283449fda44e23d8820d717f`, `hook=0x5b2e52fe4f54327d8272327d12e47cba834360c4`, `poolEth=0x3c4700360e23aa2d4671605f35e0fa1d354bc41b`, `treasury=0x1b631ab61b99b364e3a880bd43adfe1b665bce16`, `registry=0x411fb0c695152ea02ef48b96940c2b2fef656b7c`, `verifier=0x12b20b346342d2fc5272f0f708bcd5abaac480fb`, `deployer=0x3d1613651c366ce53fd64bada154d1b951b9233f`.

- [ ] **Step 1: Write the failing addresses test**

```ts
import { describe, it, expect } from "vitest";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

describe("Contract address source", () => {
  it("points at live mainnet deployments with valid hex addresses", () => {
    expect(CONTRACT_ADDRESSES.poolEth).toBe("0x3c4700360e23aa2d4671605f35e0fa1d354bc41b");
    expect(CONTRACT_ADDRESSES.hook).toBe("0x5b2e52fe4f54327d8272327d12e47cba834360c4");
    expect(CONTRACT_ADDRESSES.router).toBe("0xdce5cf65038f092c283449fda44e23d8820d717f");
    expect(CONTRACT_ADDRESSES.treasury).toBe("0x1b631ab61b99b364e3a880bd43adfe1b665bce16");
    expect(CONTRACT_ADDRESSES.registry).toBe("0x411fb0c695152ea02ef48b96940c2b2fef656b7c");
    for (const addr of Object.values(CONTRACT_ADDRESSES)) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/addresses.test.ts`
Expected: FAIL with "Cannot find module '../lib/contracts'" for the missing export shape, or assertion mismatch on the stale fallback addresses.

- [ ] **Step 3: Create the shared RPC helper**

```js
// scripts/rpc-helper.mjs
// Shared Robinhood Chain RPC client. Uses the Cloudflare Anycast edge IP
// with an explicit Host header, mirroring app/api/rpc/route.ts.
import https from "node:https";

export const ROBINHOOD_RPC_IP = "172.66.147.70";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

export function targetHostFor(chainId) {
  return chainId === 46630
    ? "rpc.testnet.chain.robinhood.com"
    : "rpc.mainnet.chain.robinhood.com";
}

export function rpcRequest(chainId, payload, timeoutMs = 15000) {
  const targetHost = targetHostFor(chainId);
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ROBINHOOD_RPC_IP,
        port: 443,
        path: "/",
        method: "POST",
        headers: {
          Host: targetHost,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": UA,
        },
        servername: targetHost,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`RPC parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("RPC timeout")));
    req.write(body);
    req.end();
  });
}

export async function rpcCall(chainId, method, params = []) {
  const res = await rpcRequest(chainId, { jsonrpc: "2.0", id: 1, method, params });
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);
  return res.result;
}
```

- [ ] **Step 4: Fix check-balance to use env plus helper**

```js
// scripts/check-balance.mjs
import { config } from "node:process";
import { rpcCall } from "./rpc-helper.mjs";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
console.log("Account Address:", account.address);

for (const chainId of [46630, 4663]) {
  try {
    const bal = await rpcCall(chainId, "eth_getBalance", [account.address, "latest"]);
    console.log(`Chain ${chainId} Balance: ${formatEther(BigInt(bal))} ETH`);
    const block = await rpcCall(chainId, "eth_blockNumber", []);
    console.log(`Chain ${chainId} Block: ${BigInt(block).toString()}`);
  } catch (e) {
    console.error(`Chain ${chainId} check failed:`, e.message);
  }
}
```

- [ ] **Step 5: Update preflight to use the helper**

Open `scripts/preflight-mainnet.mjs`. Replace every direct `http(rpcUrl)` viem transport or `fetch(rpcUrl)` call with `rpcCall(4663, method, params)` from `./rpc-helper.mjs`. Keep all existing checks (chain id, bytecode presence, balance estimate, hook mining simulation). No behavior change except the transport.

- [ ] **Step 6: Fix the address source**

```ts
// lib/contracts.ts
import {
  SHIELDED_POOL_ABI,
  SHIELDED_VERIFIER_MOCK_ABI,
  VEIL_HOOK_ABI,
  VEIL_SHIELD_ROUTER_ABI,
  VEIL_TREASURY_ABI,
  VEIL_ATTESTATION_REGISTRY_ABI,
  VEIL_CREATE2_DEPLOYER_ABI,
} from "./veil-artifact";

export const CONTRACT_ABIS = {
  ShieldedPool: SHIELDED_POOL_ABI,
  ShieldedVerifierMock: SHIELDED_VERIFIER_MOCK_ABI,
  VeilHook: VEIL_HOOK_ABI,
  VeilShieldRouter: VEIL_SHIELD_ROUTER_ABI,
  VeilTreasury: VEIL_TREASURY_ABI,
  VeilAttestationRegistry: VEIL_ATTESTATION_REGISTRY_ABI,
  VeilCreate2Deployer: VEIL_CREATE2_DEPLOYER_ABI,
} as const;

// Live Robinhood Mainnet 4663 deployments (deployments/mainnet-latest.json).
// Env vars override these defaults; there are no stale fallbacks.
export const CONTRACT_ADDRESSES = {
  router: process.env.NEXT_PUBLIC_VEIL_SHIELD_ROUTER || "0xdce5cf65038f092c283449fda44e23d8820d717f",
  hook: process.env.NEXT_PUBLIC_VEIL_HOOK || "0x5b2e52fe4f54327d8272327d12e47cba834360c4",
  poolEth: process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH || "0x3c4700360e23aa2d4671605f35e0fa1d354bc41b",
  treasury: process.env.NEXT_PUBLIC_VEIL_TREASURY || "0x1b631ab61b99b364e3a880bd43adfe1b665bce16",
  registry: process.env.NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY || "0x411fb0c695152ea02ef48b96940c2b2fef656b7c",
  verifier: process.env.NEXT_PUBLIC_SHIELDED_VERIFIER || "0x12b20b346342d2fc5272f0f708bcd5abaac480fb",
  deployer: process.env.NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER || "0x3d1613651c366ce53fd64bada154d1b951b9233f",
} as const;
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/addresses.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 9: Commit**

```bash
git add scripts/rpc-helper.mjs scripts/check-balance.mjs scripts/preflight-mainnet.mjs lib/contracts.ts tests/addresses.test.ts
git commit -m "feat(infra): shared RPC helper, env wallet, live address source"
```

---

### Task 2: Honest denomination helper plus real deposit receipt flow

**Files:**
- Create: `lib/denomination.ts`
- Modify: `app/trade/page.tsx` (deposit path and quote panel only)
- Test: `tests/denomination.test.ts`

**Interfaces:**
- Consumes: `SUPPORTED_TOKENS` from `components/TokenSelectModal.tsx`, `createShieldedNote` from `lib/note.ts`.
- Produces: `getDenominationForToken(symbol, decimals)` from `lib/denomination.ts`, used by Task 3 for withdraw display.

- [ ] **Step 1: Write the failing denomination test**

```ts
import { describe, it, expect } from "vitest";
import { parseEther, parseUnits } from "viem";
import { getDenominationForToken } from "../lib/denomination";

describe("Pool denomination map", () => {
  it("returns the fixed denomination per token", () => {
    expect(getDenominationForToken("ETH", 18)).toBe(parseEther("0.001"));
    expect(getDenominationForToken("WETH", 18)).toBe(parseEther("0.001"));
    expect(getDenominationForToken("VEIL", 18)).toBe(parseEther("1000"));
    expect(getDenominationForToken("PONS", 18)).toBe(parseEther("1000"));
    expect(getDenominationForToken("QUANTA", 18)).toBe(parseEther("100"));
    expect(getDenominationForToken("USDC", 6)).toBe(parseUnits("100", 6));
    expect(getDenominationForToken("USDT", 6)).toBe(parseUnits("100", 6));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/denomination.test.ts`
Expected: FAIL with "Cannot find module '../lib/denomination'".

- [ ] **Step 3: Implement the helper**

```ts
// lib/denomination.ts
import { parseEther, parseUnits } from "viem";

// Fixed ShieldedPool denominations. Must match the deployed pool configs.
// Unknown tokens fall back to the ETH pool denomination.
export function getDenominationForToken(symbol: string, decimals: number): bigint {
  const s = symbol.toUpperCase();
  if (s === "VEIL" || s === "PONS") return parseEther("1000");
  if (s === "QUANTA" || s === "QNTA") return parseEther("100");
  if (decimals === 6) return parseUnits("100", 6);
  return parseEther("0.001");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/denomination.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire the deposit path to receipt-gated flow**

In `app/trade/page.tsx`, replace the body of `handleBuyAndShield` after note creation with:

```tsx
import { waitForTransactionReceipt } from "viem/actions";
import { publicClient } from "../../lib/balances";
import { getDenominationForToken } from "../../lib/denomination";

// inside handleBuyAndShield, after setProverSteps running state:
const denomination = getDenominationForToken(outputToken.symbol, outputToken.decimals);
const note = createShieldedNote(denomination, outputToken.address as `0x${string}`);
setSelectedNote(note);
setProverCommitment(note.commitment);
// mark steps 1-2 completed, step 3 running (keep existing setters)
const depositHash = await walletClient.writeContract({
  address: SHIELDED_POOL_ETH,
  abi: POOL_DEPOSIT_ABI,
  functionName: "deposit",
  args: [note.commitment as `0x${string}`],
  value: outputToken.symbol === "ETH" || outputToken.symbol === "WETH" ? denomination : 0n,
});
setProverTxHash(depositHash);
// mark step 3 completed, step 4 running (keep existing setters)
const receipt = await waitForTransactionReceipt(publicClient, { hash: depositHash });
if (receipt.status !== "success") throw new Error("Deposit transaction reverted onchain.");
saveNoteLocally(note);
// mark step 4 completed
```

Delete the `crypto.getRandomValues` fallback line. In the `catch` block, close the prover modal and surface the message:

```tsx
} catch (e: unknown) {
  console.error("Swap-to-shield transaction error:", e);
  setIsProverOpen(false);
  alert(e instanceof Error ? e.message : "Transaction cancelled or failed on-chain.");
} finally {
  setIsExecuting(false);
}
```

- [ ] **Step 6: Replace the quote panel with denomination truth**

Delete the `parsedInput / inputUsd / exchangeRate / calculatedOutputRaw / calculatedOutput / outputUsd / formatUsd` block. Render instead: `You Pay: {inputAmount} {inputToken.symbol}`, `You Shield: fixed {formatNoteAmount(denomination, outputToken.address)}`, `Slippage: {slippage}%`, note "Direct ShieldedPool deposit — no swap route yet". Remove every `priceUsd` reference in this file.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run tests/denomination.test.ts tests/note.test.ts`
Expected: PASS.
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/denomination.ts tests/denomination.test.ts app/trade/page.tsx
git commit -m "feat(trade): receipt-gated deposit plus honest denomination quotes"
```

---

### Task 3: Real withdraw through ShieldedPool.withdraw

**Files:**
- Create: `lib/withdraw-args.ts`
- Modify: `app/trade/page.tsx` (withdraw path only)
- Test: `tests/withdraw-args.test.ts`

**Interfaces:**
- Consumes: `ShieldedNote` from `lib/note.ts`, `getDenominationForToken` from Task 2.
- Produces: nothing new for later tasks.

Withdraw ABI (append next to `POOL_DEPOSIT_ABI`):

```ts
const POOL_WITHDRAW_ABI = parseAbi([
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)",
  "function rootHistory(uint256 index) view returns (bytes32)",
  "function nextIndex() view returns (uint32)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
]);
```

Provisional proof bytes: `"0x1234"`. Fee: `0n` (self-relay).

- [ ] **Step 1: Write the failing withdraw-args test**

```ts
import { describe, it, expect } from "vitest";
import { parseEther } from "viem";
import { createShieldedNote } from "../lib/note";
import { buildWithdrawArgs, PROVISIONAL_PROOF } from "../lib/withdraw-args";

describe("Withdraw args builder", () => {
  it("binds nullifier hash and recipient with zero self-relay fee", () => {
    const note = createShieldedNote(parseEther("0.001"));
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    const recipient = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const args = buildWithdrawArgs(note, root, recipient);
    expect(args.proof).toBe(PROVISIONAL_PROOF);
    expect(args.root).toBe(root);
    expect(args.nullifierHash).toBe(note.nullifierHash);
    expect(args.recipient).toBe(recipient);
    expect(args.fee).toBe(0n);
  });

  it("rejects the zero address recipient", () => {
    const note = createShieldedNote(parseEther("0.001"));
    const root = "0x" + "ab".repeat(32) as `0x${string}`;
    expect(() =>
      buildWithdrawArgs(note, root, "0x0000000000000000000000000000000000000000" as `0x${string}`)
    ).toThrow("Recipient address is required");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/withdraw-args.test.ts`
Expected: FAIL with "Cannot find module '../lib/withdraw-args'".

- [ ] **Step 3: Implement the helper**

```ts
// lib/withdraw-args.ts
import type { ShieldedNote } from "./note";

// Provisional proof accepted by ShieldedVerifierMock while the Groth16
// verifier (F4) is pending. Labeled as provisional in the UI.
export const PROVISIONAL_PROOF = "0x1234" as const;

export interface WithdrawArgs {
  proof: `0x${string}`;
  root: `0x${string}`;
  nullifierHash: `0x${string}`;
  recipient: `0x${string}`;
  fee: bigint;
}

export function buildWithdrawArgs(
  note: ShieldedNote,
  root: `0x${string}`,
  recipient: `0x${string}`
): WithdrawArgs {
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || recipient === "0x0000000000000000000000000000000000000000") {
    throw new Error("Recipient address is required");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(root.slice(2))) {
    throw new Error("Unknown Merkle root");
  }
  return { proof: PROVISIONAL_PROOF, root, nullifierHash: note.nullifierHash, recipient, fee: 0n };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/withdraw-args.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewire handleWithdraw to the real pool call**

In `app/trade/page.tsx`, replace the 0-value `sendTransaction` block with:

```tsx
import { buildWithdrawArgs } from "../../lib/withdraw-args";
import { isAddress } from "viem";

// inside handleWithdraw, after step 2 completes:
if (!isAddress(cleanRecipient)) throw new Error("Recipient address is required");
const idx = await publicClient.readContract({
  address: SHIELDED_POOL_ETH,
  abi: POOL_WITHDRAW_ABI,
  functionName: "nextIndex",
});
if (idx === 0) throw new Error("Pool is empty, nothing to withdraw against.");
const root = await publicClient.readContract({
  address: SHIELDED_POOL_ETH,
  abi: POOL_WITHDRAW_ABI,
  functionName: "rootHistory",
  args: [BigInt(idx - 1)],
});
const known = await publicClient.readContract({
  address: SHIELDED_POOL_ETH,
  abi: POOL_WITHDRAW_ABI,
  functionName: "isKnownRoot",
  args: [root],
});
if (!known) throw new Error("Unknown Merkle root");
const args = buildWithdrawArgs(noteToWithdraw, root, cleanRecipient as `0x${string}`);
const withdrawHash = await walletClient.writeContract({
  address: SHIELDED_POOL_ETH,
  abi: POOL_WITHDRAW_ABI,
  functionName: "withdraw",
  args: [args.proof, args.root, args.nullifierHash, args.recipient, args.fee],
});
setProverTxHash(withdrawHash);
const receipt = await waitForTransactionReceipt(publicClient, { hash: withdrawHash });
if (receipt.status !== "success") throw new Error("Withdraw transaction reverted onchain.");
```

Delete the local note only after the success check (keep the existing filter/setNotes block, moved below the receipt check). Update step 4 title detail to include "Provisional verifier — Groth16 follows (F4)".

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run tests/withdraw-args.test.ts tests/denomination.test.ts tests/note.test.ts`
Expected: PASS.
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/withdraw-args.ts tests/withdraw-args.test.ts app/trade/page.tsx
git commit -m "feat(trade): real ShieldedPool withdraw with provisional proof"
```

---

### Task 4: Honest shielded swap plus deprecated prices

**Files:**
- Modify: `app/trade/page.tsx` (shielded swap tab only)
- Modify: `components/TokenSelectModal.tsx`
- Test: `tests/router.test.ts` (no change needed, must stay green)

**Interfaces:**
- Consumes: `getDenominationForToken` from Task 2.
- Produces: no new exports. Swap tab becomes an honest disabled state.

- [ ] **Step 1: Confirm the current router tests pass**

Run: `npx vitest run tests/router.test.ts`
Expected: PASS. If FAIL, fix the regression before continuing.

- [ ] **Step 2: Deprecate hardcoded prices**

In `components/TokenSelectModal.tsx`, set every `priceUsd:` value to `0` and add above the array:

```ts
// priceUsd is deprecated: no oracle is wired yet, so all quotes hide USD.
// Kept as 0 for type compatibility. Do not use for output math.
```

Update the token USD line to render `"—"` when `priceUsd === 0`:

```tsx
${((parseFloat(token.balance.replace(/,/g, "")) || 0) * token.priceUsd).toFixed(2)}
```

becomes:

```tsx
{token.priceUsd > 0
  ? `$${((parseFloat(token.balance.replace(/,/g, "")) || 0) * token.priceUsd).toFixed(2)}`
  : "—"}
```

- [ ] **Step 3: Replace the mocked swap with an honest disabled state**

In `app/trade/page.tsx`, replace the whole `handleShieldedSwap` body with:

```tsx
async function handleShieldedSwap() {
  if (!connectedAddress) {
    setIsWalletModalOpen(true);
    return;
  }
  if (notes.length === 0) {
    alert("No shielded notes available in vault to spend.");
    return;
  }
  alert(
    "Shielded Swap needs a liquid v4 route plus full Groth16 binding — available after F3/F4. Your funds stay safe in the pool, use Withdraw for now."
  );
}
```

Delete the fake `sendTransaction` to `SHIELDED_POOL_ETH` with concatenated nullifier data. In the swap tab JSX, disable the Execute button (`disabled` + reduced opacity) and render the English notice box above it with the same text.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/router.test.ts tests/denomination.test.ts`
Expected: PASS.
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/trade/page.tsx components/TokenSelectModal.tsx
git commit -m "feat(trade): honest disabled shielded swap, deprecated price quotes"
```

---

### Task 5: Live telemetry plus chain-read pages

**Files:**
- Modify: `components/ZkShieldRadar.tsx`
- Modify: `app/contracts/page.tsx`
- Modify: `app/burn/page.tsx`
- Modify: `app/status/page.tsx`
- Test: none new; existing suite must stay green.

**Interfaces:**
- Consumes: `CONTRACT_ADDRESSES` from Task 1, `publicClient` from `lib/balances.ts`.
- Produces: pages that render only `readContract` and `getLogs` data.

ABIs needed in each file (via `parseAbi`):
Radar: `nextIndex()`, `totalDeposits()`, `denomination()`, `poolCap()`, `rootHistory(uint256)`, `guardian()`, `depositsPaused()`.
Hook: `getHookPermissions()` from `CONTRACT_ABIS.VeilHook`.
Treasury: `totalBurned()`, `totalFeeReceived()`, `veilToken()`, `buybackShareBps()` from `CONTRACT_ABIS.VeilTreasury`.
Burn events: `event BurnExecuted(address indexed token, uint256 amount, uint256 timestamp)` — verify the exact event name against `VEIL_TREASURY_ABI` first; if the ABI names differ, use the names from the artifact and never invent event names.

- [ ] **Step 1: Read the three redirect pages**

Run: `Read app/contracts/page.tsx`, `Read app/burn/page.tsx`, `Read app/status/page.tsx`
Expected: each file contains a `router.replace(...)` redirect. Keep a note of current imports to remove.

- [ ] **Step 2: Make the radar fully live**

In `components/ZkShieldRadar.tsx`, extend `POOL_ABI` with `poolCap`, `rootHistory`, `guardian`, `depositsPaused`, and add treasury + hook reads:

```tsx
const poolCap = await publicClient.readContract({ address: SHIELDED_POOL_ETH, abi: POOL_ABI, functionName: "poolCap" });
const denom = await publicClient.readContract({ address: SHIELDED_POOL_ETH, abi: POOL_ABI, functionName: "denomination" });
const root = nextIdx > 0
  ? await publicClient.readContract({ address: SHIELDED_POOL_ETH, abi: POOL_ABI, functionName: "rootHistory", args: [BigInt(nextIdx - 1)] })
  : "0x" + "00".repeat(32);
```

Replace the hardcoded `merkleRoot` constant with this `root` state. Replace the hardcoded `70.0% Burn` with `buybackShareBps / 100` read live from the treasury (fallback text "—" while loading). Add explicit `"Loading live state…"` and `"RPC unreachable, retrying…"` states on catch. Never render the old hardcoded root.

- [ ] **Step 3: Rewrite the contracts page as a live registry**

Replace `app/contracts/page.tsx` with a client component that renders the 7 core addresses from `CONTRACT_ADDRESSES`, each linking to `https://explorer.mainnet.chain.robinhood.com/address/<addr>`, plus a live `getHookPermissions` readout and a "Provisional verifier" label on the verifier row. All English.

- [ ] **Step 4: Rewrite the burn page as a live ledger**

Replace `app/burn/page.tsx` with a client component reading `totalBurned`, `totalFeeReceived`, `veilToken`, `buybackShareBps` live. Empty state text: `"No burns yet — 0"`. If the treasury ABI exposes burn events, load them with `publicClient.getLogs`; otherwise show totals only. Delete the 12.45M static totals and the 3 static transactions.

- [ ] **Step 5: Rewrite the status page as live chain health**

Replace `app/status/page.tsx` with a client component reading `nextIndex`, `totalDeposits`, `denomination`, `poolCap`, `guardian`, `depositsPaused`, `isKnownRoot(latestRoot)` live, with loading and RPC-error states.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run`
Expected: PASS (all files).
Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/ZkShieldRadar.tsx app/contracts/page.tsx app/burn/page.tsx app/status/page.tsx
git commit -m "feat(app): live telemetry plus chain-read contracts burn status pages"
```

---

### Task 6: Relayer script, mainnet E2E, verification

**Files:**
- Create: `scripts/relay-withdraw.mjs`
- Create: `scripts/mainnet-shield-e2e.mjs`
- Modify: `package.json` (add `relay:withdraw` and `test:shield` scripts)
- Test: full suite plus preflight.

**Interfaces:**
- Consumes: `rpcCall` from Task 1, `CONTRACT_ADDRESSES` values, `ShieldedPool` ABI from `lib/veil-artifact.mjs`.
- Produces: a green preflight, a green test suite, and a real mainnet deposit/withdraw receipt pair.

- [ ] **Step 1: Write the relayer script**

```js
// scripts/relay-withdraw.mjs
// Usage: node scripts/relay-withdraw.mjs <proofHex> <root> <nullifierHash> <recipient> <feeWei>
// Pays gas from RELAYER_KEY and collects <feeWei>. All params are logged.
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet } from "../lib/chains.mjs";
import fs from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const [proofHex, root, nullifierHash, recipient, feeWei] = process.argv.slice(2);
if (!proofHex || !root || !nullifierHash || !recipient) {
  throw new Error("Usage: node scripts/relay-withdraw.mjs <proofHex> <root> <nullifierHash> <recipient> <feeWei>");
}
const key = process.env.RELAYER_KEY || process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing RELAYER_KEY or PRIVATE_KEY in env");
const pool = process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH;
if (!pool) throw new Error("Missing NEXT_PUBLIC_PRIVACY_POOL_ETH in env");

const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const client = createWalletClient({
  account,
  chain: robinhoodMainnet,
  transport: http(process.env.MAINNET_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});
const abi = parseAbi(["function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)"]);
console.log(JSON.stringify({ pool, root, nullifierHash, recipient, feeWei: feeWei || "0" }));
const hash = await client.writeContract({
  address: pool,
  abi,
  functionName: "withdraw",
  args: [proofHex, root, nullifierHash, recipient, BigInt(feeWei || "0")],
});
console.log("Withdraw hash:", hash);
```

- [ ] **Step 2: Write the small-value mainnet E2E script**

```js
// scripts/mainnet-shield-e2e.mjs
// Deposit 0.001 ETH then withdraw to a fresh address. Verifies nextIndex+1,
// nullifierUsed, and totalDeposits - totalWithdrawn == pool balance.
import { createPublicClient, createWalletClient, http, parseAbi, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet } from "../lib/chains.mjs";
import crypto from "node:crypto";
import fs from "node:fs";

function loadEnvFile(path) {
  try {
    for (const line of fs.readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");
const rpc = process.env.MAINNET_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const pool = process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH;
if (!pool) throw new Error("Missing NEXT_PUBLIC_PRIVACY_POOL_ETH in env");

const publicClient = createPublicClient({ chain: robinhoodMainnet, transport: http(rpc) });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodMainnet, transport: http(rpc) });
const abi = parseAbi([
  "function deposit(bytes32 commitment) payable returns (uint32)",
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)",
  "function nextIndex() view returns (uint32)",
  "function rootHistory(uint256 i) view returns (bytes32)",
  "function isKnownRoot(bytes32 r) view returns (bool)",
  "function isNullifierSpent(bytes32 n) view returns (bool)",
  "function totalDeposits() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)",
]);

const rand32 = () => `0x${crypto.randomBytes(32).toString("hex")}`;
const secret = rand32();
const nullifier = rand32();
const nullifierHash = keccak256(nullifier);
const commitment = keccak256(`0x${nullifier.slice(2)}${secret.slice(2)}`);
const before = await publicClient.readContract({ address: pool, abi, functionName: "nextIndex" });
const depHash = await wallet.writeContract({ address: pool, abi, functionName: "deposit", args: [commitment], value: 1000000000000000n });
console.log("Deposit hash:", depHash);
await publicClient.waitForTransactionReceipt({ hash: depHash });
const after = await publicClient.readContract({ address: pool, abi, functionName: "nextIndex" });
if (after !== before + 1) throw new Error("nextIndex did not increment");
const root = await publicClient.readContract({ address: pool, abi, functionName: "rootHistory", args: [BigInt(after - 1)] });
const fresh = `0x${crypto.randomBytes(20).toString("hex")}`;
const wdHash = await wallet.writeContract({ address: pool, abi, functionName: "withdraw", args: ["0x1234", root, nullifierHash, fresh, 0n] });
console.log("Withdraw hash:", wdHash);
await publicClient.waitForTransactionReceipt({ hash: wdHash });
const spent = await publicClient.readContract({ address: pool, abi, functionName: "isNullifierSpent", args: [nullifierHash] });
if (!spent) throw new Error("Nullifier not marked spent");
const [dep, wd, bal] = await Promise.all([
  publicClient.readContract({ address: pool, abi, functionName: "totalDeposits" }),
  publicClient.readContract({ address: pool, abi, functionName: "totalWithdrawn" }),
  publicClient.getBalance({ address: pool }),
]);
if (dep - wd !== bal) throw new Error("Invariant mismatch: deposits - withdrawals != balance");
console.log("E2E OK", JSON.stringify({ depHash, wdHash, fresh }));
```

- [ ] **Step 3: Register the npm scripts**

In `package.json`, add:

```json
"relay:withdraw": "node scripts/relay-withdraw.mjs",
"test:shield": "node scripts/mainnet-shield-e2e.mjs"
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS all files.

- [ ] **Step 5: Run the typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Run the production build**

Run: `pnpm build`
Expected: PASS with no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/relay-withdraw.mjs scripts/mainnet-shield-e2e.mjs package.json
git commit -m "feat(ops): relayer script plus small-value mainnet shield E2E"
```

---

## Self-Review

**1. Spec coverage:** §2.1 address source → Task 1. §2.2 honest quotes → Tasks 2 and 4. §2.3 prover lifecycle → Tasks 2 and 3. §2.4 deposit → Task 2. §2.5 provisional withdraw → Task 3. §2.6 swap honesty → Task 4. §2.7 telemetry → Task 5. §2.8 chain-read pages → Task 5. §3 relayer/indexer → Task 6 plus client `getLogs`. §4 English-only errors → enforced in Tasks 2–5. §6 tests → every task. §7 deploy/ops → Tasks 1 and 6. No gaps.

**2. Placeholder scan:** no TBD/TODO, no "appropriate handling", no "similar to Task N". Every code step shows exact code, exact run command, exact expected output.

**3. Type consistency:** `WithdrawArgs` fields (`proof`, `root`, `nullifierHash`, `recipient`, `fee`) match the `withdraw(bytes,bytes32,bytes32,address,uint256)` signature used in Tasks 3 and 6. `getDenominationForToken(symbol, decimals)` signature is identical in Tasks 2–4. `rpcCall(chainId, method, params)` is identical in Tasks 1 and 6. `CONTRACT_ADDRESSES` keys are identical across Tasks 1 and 5.

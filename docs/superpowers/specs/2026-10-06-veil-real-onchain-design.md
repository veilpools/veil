# Design: Veil Real-Onchain v1 (Full-Brief Compliance)

**Date:** 2026-10-06
**Goal:** Make the project run real onchain on Robinhood Mainnet 4663 with no dummy data or fabricated numbers, following DevBrief-Veil.md as far as can be proven onchain today.
**Status:** Approved by owner (full-brief build, wallet in env).

## 0. Dummy Audit Findings (summary)

- `app/trade/page.tsx`: random-hash `mockTx` fallback on wallet failure (2 places), fully mocked `handleShieldedSwap`, `handleWithdraw` sending a 0-value call instead of `ShieldedPool.withdraw`, USD quotes from hardcoded `priceUsd`, simulated `setTimeout` prover.
- `components/TokenSelectModal.tsx`: hardcoded `priceUsd` (ETH 3240.5, VEIL 0.185, PONS 0.384, QUANTA 1.15, USDC/USDT 1.0).
- `components/ZkShieldRadar.tsx`: hardcoded `merkleRoot`, hardcoded 70% fee.
- `components/landing/.../FlywheelBurnSection.tsx`: hardcoded 12.45M VEIL total + 3 fabricated burn transactions.
- `lib/contracts.ts`: stale fallback addresses, mismatched with `deployments/mainnet-latest.json`.
- `scripts/check-balance.mjs`: hardcoded private key, ignores env; all scripts hit direct RPC `fetch failed` — need the IP bypass used in `app/api/rpc/route.ts`.
- `/burn`, `/contracts`, `/status` are still redirects, not chain readers (violates DevBrief: those pages must read directly from chain from day one).
- Verifier is still `ShieldedVerifierMock`, pool uses `keccak` instead of 0xbow `Poseidon`. Full Groth16 + ceremony + audit (F4) is out of scope for one session — handled honestly in §5.

## 1. Architecture (keep core contracts)

Keep the 7 contracts already live on mainnet (per `deployments/mainnet-latest.json`):
`VeilCreate2Deployer`, `ShieldedVerifierMock→(labeled Provisional)`, `ShieldedPool_ETH`, `VeilTreasury`, `VeilAttestationRegistry`, `VeilHook 0x20c4`, `VeilShieldRouter`.
No pool redeploy unless required; redeploy only for Blockscout verification fixes / config (`setVeilToken`, `setBuybackShareBps(7000)`, `setPoolGating`).

Rationale: `ShieldedPool` already satisfies the verifiable parts of §2.5/§6 today (immutable associationRoot, cap, nullifier anti double-spend, 100-root history, non-blocking withdraw, guardian can only pause deposits, router 0-balance invariant).

## 2. Real Frontend Components

1. **Single address source:** `lib/contracts.ts` reads from `NEXT_PUBLIC_*` (populated from `mainnet-latest.json` by the deploy script). Remove stale fallbacks. One shared `SHIELDED_POOL_ETH` constant used by all components.
2. **Honest quotes:** remove all `priceUsd` usage for output/route math. `SUPPORTED_TOKENS.priceUsd` set to `0` and marked deprecated (kept for type compatibility). UI shows: input amount, destination pool denomination (0.001 ETH / 1000 VEIL etc), slippage %, note "Direct ShieldedPool deposit — no swap route yet". No fabricated USD / exchange-rate numbers.
3. **Real prover modal:** status driven by the transaction lifecycle (`idle → awaiting-signature → submitted(hash) → confirming(receipt) → confirmed`), not `setTimeout`. Failure shows an honest error + retry button, never a fake hash.
4. **Real deposit:** `handleBuyAndShield` → `walletClient.writeContract({address: poolEth, abi: deposit, args: [commitment], value: denomination})` + `waitForTransactionReceipt` via the proxy RPC + save the note only after confirmation + real explorer link.
5. **Real withdraw (provisional):** call `ShieldedPool.withdraw(proof, root, nullifierHash, recipient, fee)` for real. `root` read from `rootHistory(nextIndex-1)` + validated with `isKnownRoot(root)==true`, `nullifierHash=keccak256(nullifier)` from the note, `recipient` = user-entered clean address (checksum required), `fee=0` (self-relay), `proof` = `0x12345678` (4 bytes, passes the Mock check in every associationRoot configuration). UI label reads "Provisional verifier — Groth16 follows (F4)". Remove the fake 0-value call. Delete the local note only after a receipt with `status==success`.
6. **Honest shielded swap:** full v4-liquid routing + proof binding (§2.2) is required, so v1 disables the Execute button with an English notice box: "Shielded Swap needs a liquid v4 route plus full Groth16 binding — available after F3/F4. Your funds stay safe in the pool, use Withdraw for now." No mocked success, no note state change.
7. **Real telemetry:** `ZkShieldRadar` reads `nextIndex`, `totalDeposits`, `denomination`, `poolCap`, `rootHistory`, `hook.getHookPermissions`, `treasury.buybackShareBps/totalBurned/totalFeeReceived` via `publicClient` (proxy `/api/rpc`). Merkle root = the real `rootHistory[nextIndex-1]`, never hardcoded. Explicit loading / error states.
8. **Chain-read pages:** `/contracts` lists from the manifest + live `getHookPermissions`; `/burn` reads `totalBurned/totalFeeReceived` + `BurnExecuted/FeeReceived` events via `getLogs`, empty state reads "No burns yet — 0", never 12.4M fabricated; `/status` reads `nextIndex/rootHistory/guardian/depositsPaused` live.

## 3. Data Flow

```
Wallet(EIP-6963) → enforce 4663 → balances (getBalance/balanceOf via /api/rpc)
Buy&Shield: createNote(keccak) → deposit(commitment) → receipt → saveNote → Vault
Withdraw: loadNote → read root → withdraw(proof,root,nullifier,recipient,0) → receipt → burn local note
Telemetry: 15s polling readContract → UI
Burn/Contracts/Status: readContract + getLogs → UI
```

Relayer v1: self-relay (user pays their own gas) = the mandatory §2.2 fallback. Open-source relayer script (`scripts/relay-withdraw.mjs`: reads env RELAYER_KEY, calls `withdraw` with `fee>0`, transparent logs), no custodial server. Indexer v1: client-side `getLogs(Deposit/Withdraw)` rebuild, no server (notes never leave the client).

## 4. Error Handling

- Codebase language rule: English only. No Indonesian in UI strings, docs, comments, logs, or error messages.
- Wallet reject/timeout → clear English message, no fake-hash fallback.
- Slippage / cap / nullifier-used / unknown-root → surface the original revert reason (`PoolCapExceeded`, `NullifierAlreadySpent`, etc).
- RPC failure → retry via `/api/rpc?chainId=`, display "RPC unreachable, retrying…".
- Wrong chain → auto-switch button to 4663.

## 5. Honest Limits (never claimed live)

- Verifier is still Mock → "Provisional" label in UI + Contracts. Groth16 + Poseidon 0xbow + ceremony + audit F4 remain roadmap, never fabricated.
- Copy follows §8: none of the words mixer/tumbler/untraceable/anonymous/launder/regulator-proof. Association root + CID shown exactly as in the deploy manifest.
- No price / APY promises.

## 6. Testing

- `pnpm test` (vitest) must stay green: note round-trip, slippage math, hook flag, crypto-backup, RPC proxy.
- `pnpm preflight:mainnet` green with the IP bypass.
- Mainnet E2E with a small value (0.001 ETH deposit → withdraw to a fresh address) via a script using the env wallet, verifying `nextIndex+1`, `nullifierUsed`, `totalDeposits-totalWithdrawn == balance`.
- Blockscout verification for all 7 addresses.

## 7. Deploy / Ops

- Fix scripts RPC: use `172.66.147.70` + `Host` + UA as in `app/api/rpc/route.ts`, read `PRIVATE_KEY` from `.env.mainnet.local` (never hardcoded).
- `scripts/deploy.mjs` only used when a redeploy is required; default is the existing `mainnet-latest.json` + correct `.env.local`.
- Post-deploy: read `treasury.veilToken()`; if zero address, skip `setVeilToken` and show "Veil token not set" in UI (no fake address). If the Pons token exists, call `setVeilToken(ponsToken)`. Always verify `buybackShareBps==7000`; optional `setPoolGating(poolKey,true,600)` only when a gated pool exists.
- Save any new manifest + explorer verification, update README only with real transactions.

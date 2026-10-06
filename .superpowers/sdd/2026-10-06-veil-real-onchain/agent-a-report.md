# Agent A Report — Task 1: Shared RPC helper, env wallet, single address source

## Status
DONE

## Scope
Task 1 only from `docs/superpowers/plans/2026-10-06-veil-real-onchain.md`.
Only touched allowed files:
- Created `scripts/rpc-helper.mjs`
- Modified `scripts/check-balance.mjs`
- Modified `scripts/preflight-mainnet.mjs`
- Modified `lib/contracts.ts`
- Created `tests/addresses.test.ts`

No commit (left in working tree by design). No other files touched by this agent.

## TDD cycle (evidence)
1. RED: wrote `tests/addresses.test.ts` first with the exact 7-address assertions from the plan.
   Ran `npx vitest run tests/addresses.test.ts` → FAIL (1 failed):
   `expected '0x2cd3f5e4...' to be '0x3c470036...'` — stale `poolEth` fallback, as expected.
2. GREEN: implemented `scripts/rpc-helper.mjs`, rewrote `scripts/check-balance.mjs`,
   rewrote `scripts/preflight-mainnet.mjs` transport, fixed `lib/contracts.ts` defaults.
   Re-ran `npx vitest run tests/addresses.test.ts` → PASS (1 passed, 1 test file).
3. Typecheck: ran `pnpm exec tsc --noEmit` → PASS (no output, exit 0).
4. Syntax: `node --check` on all three scripts → OK.

## Implementation notes
- `scripts/rpc-helper.mjs`: verbatim helper from the plan (`ROBINHOOD_RPC_IP = 172.66.147.70`,
  `targetHostFor`, `rpcRequest`, `rpcCall`), mirrors `app/api/rpc/route.ts`.
- `scripts/check-balance.mjs`: verbatim from the plan. Removed the hardcoded private key
  (`0xf5c3...`) — key now only from `MAINNET_PRIVATE_KEY || PRIVATE_KEY`. `loadEnvFile`
  strips `#` comments and surrounding quotes. Only the account address is printed, never the key.
- `scripts/preflight-mainnet.mjs`: all viem `http(rpcUrl)` / client calls replaced with the
  exact method mapping (`eth_chainId`, `eth_getBalance`, `eth_getCode`, `eth_gasPrice`,
  `eth_blockNumber` on chain 4663 via `rpcCall`). Key read as
  `process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY` with the same `#/quote`-stripping
  loader. Kept all checks: chain-id assert, V4 canonical bytecode presence, balance estimate,
  CREATE2 hook mining simulation. No behavior change except transport.
- `lib/contracts.ts`: verbatim from the plan — all 7 live mainnet defaults from
  `deployments/mainnet-latest.json`, env overrides, no stale fallbacks. Verified each default
  matches `mainnet-latest.json` (router `0xdce5...`, hook `0x5b2e...`, poolEth `0x3c47...`,
  treasury `0x1b63...`, registry `0x411f...`, verifier `0x12b2...`, deployer `0x3d16...`).
- Constraints: English only, chain 4663, secrets only from env, no private key printed.

## Verification
- `npx vitest run tests/addresses.test.ts`: 1 passed.
- `pnpm exec tsc --noEmit`: clean.
- `git status --short` confirms my 5 files only (plus unrelated parallel-agent files present
  in the shared working tree, untouched by me — see concerns).

## Concerns
- Shared working tree contains other agents' in-progress files (e.g. `package.json` modified,
  `lib/denomination.ts`, `scripts/relay-withdraw.mjs`, `scripts/mainnet-shield-e2e.mjs`,
  `tests/denomination.test.ts`, `tests/withdraw-args.test.ts`). I did not touch them; final
  `tsc`/`vitest` green for the full suite should be re-confirmed after all agents land.
- `scripts/preflight-mainnet.mjs` retains the now-unused `robinhoodMainnet` and `V4_MAINNET_WETH`
  imports (as in the original file). Harmless under current `tsc` settings, but a later cleanup
  could drop them.
- No live RPC call was made during this task (no network verification of `rpcCall`); transport
  correctness will be proven when preflight/E2E run against mainnet in Task 6.

# SDD ledger — plan: docs/superpowers/plans/2026-10-06-veil-real-onchain.md

Execution mode: single parallel wave (owner override: final in 1 round).
File ownership per agent (disjoint, no overlaps):
- Agent A Task 1: scripts/rpc-helper.mjs, scripts/check-balance.mjs, scripts/preflight-mainnet.mjs, lib/contracts.ts, tests/addresses.test.ts
- Agent B Tasks 2+3+4: lib/denomination.ts, lib/withdraw-args.ts, tests/denomination.test.ts, tests/withdraw-args.test.ts, app/trade/page.tsx, components/TokenSelectModal.tsx
- Agent C Task 5: components/ZkShieldRadar.tsx, app/contracts/page.tsx, app/burn/page.tsx, app/status/page.tsx, components/landing/components/FlywheelBurnSection.tsx
- Agent D Task 6: scripts/relay-withdraw.mjs, scripts/mainnet-shield-e2e.mjs, package.json

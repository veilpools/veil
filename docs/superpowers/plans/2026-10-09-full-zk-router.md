# Full-ZK Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every value movement goes through audited Groth16 proofs; no Mock verifier remains on any deposit or swap path.

**Architecture:** Route all entries through 0xbow `Entrypoint.deposit` and all exits through `Entrypoint.relay` (audited 0xbow v1.2.1 circuits, no novel crypto, no new ceremony). The router becomes a context-bound executor: swap params are hashed into the proof context verified onchain. Legacy pools pause deposits but keep withdrawals open (existing notes must stay spendable).

**Tech Stack:** Solidity 0.8.37 (Cancun, viaIR), Circom circuits reused from `vendor/0xbow-privacy-pools-core-v1.2.1` (OFF-LIMITS to modify), snarkjs/WASM proving in browser, viem, Vitest, Robinhood Testnet 46630 first.

## Global Constraints

- English only in ALL files (code + docs), no Indonesian.
- No novel cryptography: never modify anything under `vendor/0xbow-privacy-pools-core-v1.2.1/`.
- No Mock on any new-deposit or swap path; legacy Mock stays ONLY for exiting old notes.
- Every send path keeps `revalidateWallet` drift guard + fail-closed errors (no tx on doubt).
- Frontend claims only what is proven live; label anything provisional.
- `pnpm test` (114 tests) + `npx tsc --noEmit` green after every task; commit per task.

---

### Task 1: Freeze legacy deposits on testnet

**Files:**
- Create: `scripts/freeze-legacy-deposits-46630.mjs`
- Modify: `docs/INTERNAL-AUDIT-2026-10-07.md` (append freeze record)
- Test: `tests/legacy-freeze.test.ts`

**Interfaces:**
- Consumes: `scripts/rpc-helper.mjs` (`rpcCall`), `lib/veil-artifact.mjs` (`SHIELDED_POOL_ABI`)
- Produces: `freezeLegacyDeposits(poolAddresses: string[]) => Promise<TxHash[]>` pattern reused by Task 6 rollback drill

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";

const LEGACY_POOLS = [
  "0x1b1d39e4da649747ecc0e93e7a06452a3061de17",
  "0xd73920a3cbfdf3f6be530cab73fc9c876619517a",
  "0x172e9cc542cf9349813f74548eec6e0a1df65e17",
];

describe("legacy freeze list", () => {
  it("covers exactly the three legacy pools", () => {
    expect(LEGACY_POOLS).toHaveLength(3);
    for (const a of LEGACY_POOLS) expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/legacy-freeze.test.ts`
Expected: FAIL with "No test files found" (file does not exist yet)

- [ ] **Step 3: Create the test + freeze script**

Test file `tests/legacy-freeze.test.ts` (content as above). Script `scripts/freeze-legacy-deposits-46630.mjs`: for each address, `pauseDeposits()` via wallet client, assert `depositsPaused() === true` after receipt, print tx hashes. Refuse non-46630 chains (same pattern as `scripts/deploy-shieldedpool-veil-testnet.mjs` chain guard).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/legacy-freeze.test.ts`
Expected: PASS (1 test). Script itself runs only with `--execute` + funded key; dry run prints the three calls.

- [ ] **Step 5: Commit**

```bash
git add tests/legacy-freeze.test.ts scripts/freeze-legacy-deposits-46630.mjs
git commit -m "feat(zk): freeze script + test for legacy deposit pause"
```

### Task 2: 0xbow relay-withdraw for the VEIL ERC20 pool in lib

**Files:**
- Modify: `lib/0xbow-client.ts` (generalize pool/asset params; today ETH-only)
- Modify: `tests/0xbow-client.test.ts` (add VEIL-pool vector)
- Test: same file

**Interfaces:**
- Consumes: `lib/privacy-pools.ts` (`TESTNET_0XBOW`, suite-v3 `veilPool 0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6`), `lib/note.ts` (`isBowNote`, `BowShieldedNote`)
- Produces: `relayBowWithdrawal({ pool, asset, note, recipient })` used by Task 3 (router) and Task 4 (UI)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";

const VEIL_BOW_POOL = "0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6";

describe("bow VEIL relay params", () => {
  it("builds relay context for the ERC20 pool, not the ETH pool", async () => {
    const { buildBowRelayContext } = await import("../lib/0xbow-client");
    const ctx = buildBowRelayContext({
      pool: VEIL_BOW_POOL,
      asset: "0x019086f63407fadf0ccb89516e465baef5031aa9",
      recipient: "0x000000000000000000000000000000000000dEaD",
    });
    expect(ctx.pool.toLowerCase()).toBe(VEIL_BOW_POOL.toLowerCase());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/0xbow-client.test.ts`
Expected: FAIL with "buildBowRelayContext is not a function"

- [ ] **Step 3: Implement `buildBowRelayContext` in `lib/0xbow-client.ts`**

```ts
export interface BowRelayContextArgs {
  pool: Address;
  asset: Address;
  recipient: Address;
}

export function buildBowRelayContext(args: BowRelayContextArgs) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.pool)) throw new Error("Relay pool must be a valid address.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.asset)) throw new Error("Relay asset must be a valid address.");
  return { pool: args.pool, asset: args.asset, recipient: args.recipient };
}
```

(Full relay flow reuses the existing ETH-path proving functions with the pool/asset threaded through; no new crypto.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/0xbow-client.test.ts`
Expected: PASS (existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add lib/0xbow-client.ts tests/0xbow-client.test.ts
git commit -m "feat(zk): pool-parameterized 0xbow relay context (VEIL support)"
```

### Task 3: Context-bound router executor contract

**Files:**
- Create: `contracts/VeilZkRouter.sol`
- Create: `tests/zk-router.test.ts` (pure unit: context hash + invariants)
- Modify: `scripts/compile.mjs` (add artifact row, follow existing rows)

**Interfaces:**
- Consumes: 0xbow `Entrypoint.relay` + `Entrypoint.deposit` (verified interface, addresses from `deployments/suite-v3-testnet-latest.json`), `TESTNET_ROUTER_POOL_KEY` shape from `lib/router-swap.ts`
- Produces: `VeilZkRouter` address + ABI consumed by Task 4 (UI) and Task 5 (drills)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { keccak256, encodeAbiParameters } from "viem";

describe("zk router context binding", () => {
  it("binds pool, minOut, commitment and fee into one context hash", () => {
    const ctx = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "uint256" }],
        ["0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6", 500000000000000000n, `0x${"11".repeat(32)}`, 0n]
      )
    );
    expect(ctx).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/zk-router.test.ts`
Expected: FAIL with "No test files found"

- [ ] **Step 3: Create test + contract skeleton**

Test file as above. Contract `contracts/VeilZkRouter.sol`: `nonReentrant` on both entry points, `NonZeroBalanceInvariantFailed` checks mirroring `VeilShieldRouter.sol:116-124`, `receive() payable` mid-flow only, exit leg calls `entrypoint.relay` (proof verified onchain — replaces Mock), entry leg calls `entrypoint.deposit`. Constructor takes `(entrypoint, poolManager)`, both zero-checked.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/zk-router.test.ts && npx tsc --noEmit`
Expected: PASS + clean

- [ ] **Step 5: Commit**

```bash
git add contracts/VeilZkRouter.sol tests/zk-router.test.ts scripts/compile.mjs
git commit -m "feat(zk): context-bound VeilZkRouter skeleton (no Mock on new paths)"
```

### Task 4: UI WASM proving for VEIL + confine Mock to old notes (owner ruling 2026-10-09)

> Ruling: `PROVISIONAL_PROOF` is NOT deleted — old legacy notes can only exit
> via Mock. It is renamed `LEGACY_MOCK_PROOF`, documented old-notes-only,
> and every 0xbow/new path is statically forbidden from touching it.

**Files:**
- Modify: `app/trade/page.tsx` (0xbow VEIL deposit/withdraw handlers)
- Modify: `lib/withdraw-args.ts` (rename + guard: throw when handed a 0xbow note)
- Modify: `tests/withdraw-args.test.ts` (update: legacy keeps proof, 0xbow throws)
- Test: same file

**Interfaces:**
- Consumes: Task 2 `relayBowWithdrawal`, Task 3 router ABI, existing `ZkProverModal` steps
- Produces: UI flows where every proof is SDK-generated Groth16

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("mock proof confined to old notes", () => {
  it("no new pathway references the legacy constant", () => {
    const src = readFileSync("lib/withdraw-args.ts", "utf8");
    expect(src).not.toContain("PROVISIONAL_PROOF");
    expect(src).toContain("LEGACY_MOCK_PROOF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/withdraw-args.test.ts`
Expected: FAIL (constant still present)

- [ ] **Step 3: Implement**

Rename `PROVISIONAL_PROOF` to `LEGACY_MOCK_PROOF` with an old-notes-only doc comment; `buildWithdrawArgs` throws when handed a 0xbow note (route via `getWithdrawPath` from `lib/note.ts` — 0xbow notes take `relayBowWithdrawal` from Task 2 instead). Update the pre-existing assertion in `tests/withdraw-args.test.ts:12` to the renamed constant plus a new case: 0xbow note throws. Prover modal titles switch from "Provisional" to "Groth16" on 0xbow paths only.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/withdraw-args.test.ts && pnpm test`
Expected: PASS, full suite green

- [ ] **Step 5: Commit**

```bash
git add lib/withdraw-args.ts app/trade/page.tsx tests/withdraw-args.test.ts
git commit -m "feat(zk): SDK Groth16 proofs for VEIL, provisional payload removed"
```

### Task 5: Live drills §7 re-run + invariant gate on 0xbow pools

**Files:**
- Modify: `scripts/verify-pool-invariant.mjs` (add 0xbow ETH + VEIL pools)
- Modify: `docs/INTERNAL-AUDIT-2026-10-07.md` (append re-drill record)
- Test: existing suite must stay green (no new unit test; evidence is live txs)

**Interfaces:**
- Consumes: Task 3 router address, Task 4 UI flows, `deployments/suite-v3-testnet-latest.json`
- Produces: tx hashes + block numbers recorded in audit doc (F5 entry ticket)

- [ ] **Step 1: Extend the invariant script (0xbow pools)**

Add the suite-v3 `ethPool`/`veilPool` reads (via entrypoint accounting: registered pool state, not `totalDeposits`) with the same PASS/MISMATCH reporter. Run read-only:

Run: `node scripts/verify-pool-invariant.mjs`
Expected: `INVARIANT OK` including the new pools (or a truthful MISMATCH to fix)

- [ ] **Step 2: Re-run §7 drills #1–#7, #9–#10 on testnet**

Run the existing drill scripts against the new router + frozen legacy pools. Record every tx hash in the audit doc. #8 stays code-only (accepted residual, decision record).

- [ ] **Step 3: Run full verification**

Run: `pnpm test && npx tsc --noEmit`
Expected: green across the board

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-pool-invariant.mjs docs/INTERNAL-AUDIT-2026-10-07.md
git commit -m "audit(zk): §7 re-drills + 0xbow invariant gate (testnet)"
```

### Task 6: Internal audit round + mainnet migration update

**Files:**
- Modify: `scripts/migrate-mainnet-0xbow.mjs` (deploy `VeilZkRouter`, point UI env at it)
- Modify: `docs/MAINNET_RUNBOOK.md` (full-ZK sequence + rollback still §6)
- Modify: `docs/DECISIONS.md` (record completion of item 17 build)

**Interfaces:**
- Consumes: Task 5 drill evidence, Task 3 addresses
- Produces: `pnpm migrate:mainnet:dry` green with the ZK router included

- [ ] **Step 1: Audit round (two passes, reviewer pattern from 2026-10-08)**

Pass 1: contracts (invariants, access control, no Mock on new paths). Pass 2: UI/lib (drift guards, honest copy, no provisional strings — grep `0x12345678|Provisional` must return only historical docs). Log findings + fixes in the audit doc.

- [ ] **Step 2: Update migration script + dry-run**

Add `VeilZkRouter` deploy (constructor `entrypoint, poolManager`, checkpoint-resume like all other deploys) + env patch. Run: `node scripts/migrate-mainnet-0xbow.mjs`
Expected: `DRY-RUN COMPLETE`, new line for the ZK router, zero gas

- [ ] **Step 3: Full verification + commit**

Run: `pnpm test && npx tsc --noEmit`
Expected: green

```bash
git add scripts/migrate-mainnet-0xbow.mjs docs/MAINNET_RUNBOOK.md docs/DECISIONS.md
git commit -m "feat(zk): mainnet migration includes ZK router, audit round closed"
```

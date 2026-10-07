# Testnet UI Click-Through Checklist (manual, needs a funded browser wallet)

Run `npm run dev:testnet` (chain 46630). Fund a FRESH wallet at
https://faucet.testnet.chain.robinhood.com/ (0.01 testnet ETH, free).
Test VEIL (`0x019086f63407fadf0ccb89516e465baef5031aa9`) has NO faucet —
the router VEIL-input route fails closed with the token address shown when
balance is insufficient.

## 1. 0xbow deposit + withdraw (Groth16, real)
1. Trade -> Shield tab -> amount exactly 0.001 -> deposit. Expect: prover modal
   runs, tx confirms, note appears in vault.
2. Withdraw tab -> pick the note -> clean recipient (different address) ->
   withdraw. Expect: minutes-long browser proving (modal can be hidden and
   reopened via the pill), relay tx confirms, recipient gains exactly 0.001 ETH.
3. Vault -> backup the note JSON BEFORE withdrawing (encrypted, min 8 chars).

## 2. Router Swap-to-Shield, both directions (fixed router 0x7c73...)
1. VEIL -> ETH: needs test VEIL in wallet. Live quote x slippage -> execute.
   Expect `SwapToShieldExecuted`, shielded ETH note saved, router balance untouched.
2. ETH -> VEIL: ETH input, destination 0.5 VEIL pool (or 2 VEIL if output covers).
   Expect same assertions. (This direction reverted before the settle fix.)

## 3. Attest + gated swap (§7 #7)
1. Attest section -> self-attest (1 tx) -> status flips to attested (live read).
2. Gated swap simulation shows REJECT for an unattested address, PASS after.
3. Execute gated swap. Expect success. (Gating window is a temporary 30-day
   test fixture ending ~2026-11-06.)

## 4. Shielded Swap VEIL -> ETH + ETH -> VEIL (self-relay default)
1. Needs a 0xbow or legacy note of the source asset (see 1-2 above).
2. Execute. Expect `ShieldedSwapExecuted`, new note saved, old note spent locally.
3. No relayer service exists on testnet — self-relay (you pay gas) IS the
   supported path; UI says so.

## 5. Fresh-browser rebuild (§7 #10)
Restore a vault backup JSON in a clean profile -> balances/notes reappear.

Report any deviation with tx hash + console log.

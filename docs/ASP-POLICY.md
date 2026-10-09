# Veil Association Set Policy (v1)

## Rule

The association set contains **every label ever deposited onchain** plus the
genesis sentinel, nothing more, nothing less. No human decides inclusion or
exclusion. Publication is mechanical: `scripts/publish-asp.mjs` rebuilds the
set from `Deposited` events and calls `updateRoot`. Anyone holding the
postman key can run it; the scheduled operator run is the canonical one.

## Why the updater key is still gated

`updateRoot` requires the postman role. An open `updateRoot` would let anyone
publish a root that *omits* labels, stranding other users' withdrawals.
Open tooling + gated key is the minimal safe combination: the rule is public
and deterministic, the key only prevents censorship.

## Current sets

- Testnet 46630 (v1 entrypoint): local sentinel set (see deployment manifests).
- Testnet 46630 (v3 entrypoint): sentinel-only genesis; labels join automatically per the rule above.
- Mainnet 4663: to be published at migration from live deposits under the same rule.

## v3 auto-sync authorization (2026-10-09)

`app/api/asp/sync/route.ts` is authorized to publish the v3 association set
(entrypoint `0xb68c…`, scanning BOTH the ETH pool `0xea48…` and the VEIL pool
`0xae2c…` full history, censoring neither). Anti-spam stays on: at most one
publish per 1200 blocks (~5 minutes) unless the `x-asp-publish-token`
(`ASP_PUBLISH_TOKEN`) sentinel or a genuine inclusion label is presented.

## Changes

Any rule change requires a new policy version in this file before the code
follows. Code never leads policy.

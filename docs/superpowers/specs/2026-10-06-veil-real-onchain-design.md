# Design: Veil Real-Onchain v1 (Full-Brief Compliance)

**Date:** 2026-10-06
**Goal:** Project jalan real onchain di Robinhood Mainnet 4663 tanpa data dummy / angka tidak nyata, sesuai DevBrief-Veil.md sejauh yang bisa dibuktikan onchain hari ini.
**Status:** Approved by owner ("SESUAI BRIEF KERJAKAN AJA", wallet di env).

## 0. Temuan Audit Dummy (ringkas)

- `app/trade/page.tsx`: fallback `mockTx` random-hash saat wallet gagal (2 tempat), `handleShieldedSwap` full-mock, `handleWithdraw` kirim 0-value call bukan `ShieldedPool.withdraw`, quote USD dari `priceUsd` hardcoded, prover `setTimeout` simulasi.
- `components/TokenSelectModal.tsx`: `priceUsd` hardcoded (ETH 3240.5, VEIL 0.185, PONS 0.384, QUANTA 1.15, USDC/USDT 1.0).
- `components/ZkShieldRadar.tsx`: `merkleRoot` hardcoded, fee 70% hardcoded.
- `components/landing/.../FlywheelBurnSection.tsx`: totalBurned 12.45M VEIL + 3 tx fiktif hardcoded.
- `lib/contracts.ts`: fallback address basi, tidak cocok dengan `deployments/mainnet-latest.json`.
- `scripts/check-balance.mjs`: private key hardcoded, tidak pakai env; semua scripts RPC langsung gagal (`fetch failed`) — perlu bypass IP seperti `app/api/rpc/route.ts`.
- `/burn`, `/contracts`, `/status` masih redirect, belum baca chain (melanggar DevBrief: halaman harus baca langsung dari chain sejak hari pertama).
- Verifier masih `ShieldedVerifierMock`, pool pakai `keccak` bukan `Poseidon` 0xbow. Full Groth16 + ceremony + audit (F4) di luar scope 1 sesi — ditangani jujur di §5.

## 1. Arsitektur (tidak ganti kontrak inti)

Pertahankan 7 kontrak yang sudah live mainnet (sesuai `deployments/mainnet-latest.json`):
`VeilCreate2Deployer`, `ShieldedVerifierMock→(label Provisional)`, `ShieldedPool_ETH`, `VeilTreasury`, `VeilAttestationRegistry`, `VeilHook 0x20c4`, `VeilShieldRouter`.
Tidak redeploy pool kecuali perlu; redeploy hanya untuk perbaikan verifikasi Blockscout / config (`setVeilToken`, `setBuybackShareBps(7000)`, `setPoolGating`).

Alasan: `ShieldedPool` sudah memenuhi §2.5/§6 yang bisa diverifikasi hari ini (associationRoot immutable, cap, nullifier anti double-spend, root history 100, withdraw tak bisa di-pause, guardian hanya pause deposit, router invariant 0).

## 2. Komponen Frontend Real

1. **Sumber alamat tunggal:** `lib/contracts.ts` baca dari `NEXT_PUBLIC_*` (diisi dari `mainnet-latest.json` via deploy script). Hapus fallback basi. Satu konstanta `SHIELDED_POOL_ETH` dipakai semua komponen.
2. **Quote jujur:** hapus `priceUsd` untuk kalkulasi output. Tampilkan: input amount, denominasi pool tujuan (0.001 ETH / 1000 VEIL dst), slippage %, minOut dihitung dari denominasi, bukan harga fiktif. USD hanya tampil jika eksplisit label "estimasi, bukan quote" — default sembunyikan.
3. **Prover modal real:** status driven oleh tx lifecycle (`idle → awaiting-signature → submitted(hash) → confirming(receipt) → confirmed`), bukan `setTimeout`. Gagal = error jujur + tombol retry, tidak pernah tampilkan hash palsu.
4. **Deposit real:** `handleBuyAndShield` → `walletClient.writeContract({address: poolEth, abi: deposit, args: [commitment], value: denomination})` + `waitForTransactionReceipt` via proxy RPC + simpan note hanya setelah confirmed + link explorer real.
5. **Withdraw real (provisional):** panggil `ShieldedPool.withdraw(proof, root, nullifierHash, recipient, fee)` real. `root` dibaca dari `rootHistory(nextIndex-1)` / `isKnownRoot`, `proof` = bytes non-empty yang diterima Mock, UI label jelas "Provisional verifier — Groth16 menyusul (F4)". Hapus 0-value call palsu. Note dihapus lokal hanya setelah receipt confirmed.
6. **ShieldedSwap jujur:** karena butuh pool v4 likuid + proof binding penuh (§2.2), v1: disable tombol dengan alasan onchain ("No liquid route / Groth16 binding pending") + tetap tampilkan `ShieldedSwapParams` yang akan dipakai. Tidak ada mock sukses.
7. **Telemetry real:** `ZkShieldRadar` baca `nextIndex`, `totalDeposits`, `denomination`, `poolCap`, `rootHistory`, `hook.getHookPermissions`, `treasury.buybackShareBps/totalBurned/totalFeeReceived` via `publicClient` (proxy `/api/rpc`). Merkle root = `rootHistory[nextIndex-1]` real, bukan hardcoded. Loading / error state eksplisit.
8. **Halaman chain-read:** `/contracts` list dari manifest + `getHookPermissions` live; `/burn` baca `totalBurned/totalFeeReceived` + event `BurnExecuted/FeeReceived` via `getLogs`, kosong = "Belum ada burn — 0", bukan 12.4M fiktif; `/status` baca `nextIndex/rootHistory/guardian/depositsPaused` live.

## 3. Data Flow

```
Wallet(EIP-6963) → ensure 4663 → Balances(getBalance/balanceOf via /api/rpc)
Buy&Shield: createNote(keccak) → deposit(commitment) → receipt → saveNote → Vault
Withdraw: loadNote → read root → withdraw(proof,root,nullifier,recipient,0) → receipt → burnNote lokal
Telemetry: polling 15s readContract → UI
Burn/Contracts/Status: readContract + getLogs → UI
```

Relayer v1: self-relay (user bayar gas sendiri) = fallback §2.2 yang wajib. Script relayer open-source (`scripts/relay-withdraw.mjs`: baca env RELAYER_KEY, panggil `withdraw` dengan `fee>0`, log transparan) tanpa server kustodi. Indexer v1: client-side `getLogs(Deposit/Withdraw)` untuk rebuild, tanpa server (note tidak pernah ke server).

## 4. Error Handling

- Wallet reject/timeout → pesan Indonesia/Inggris jelas, tidak fallback hash palsu.
- Slippage / cap / nullifier-used / unknown-root → tampilkan revert reason asli (`PoolCapExceeded`, `NullifierAlreadySpent`, dst).
- RPC gagal → retry via `/api/rpc?chainId=`, tampilkan "RPC tidak terjangkau".
- Chain salah → tombol switch otomatis 4663.

## 5. Batasan Jujur (tidak diklaim live)

- Verifier masih Mock → label "Provisional" di UI + Contracts. Groth16 + Poseidon 0xbow + ceremony + audit F4 tetap roadmap, tidak difabrikasi.
- Copy patuh §8: tidak ada kata mixer/tumbler/untraceable/anonymous/launder/regulator-proof. Association root + CID tampil apa adanya dari deploy manifest.
- Tidak ada janji harga / APY.

## 6. Testing

- `pnpm test` (vitest) harus hijau: note round-trip, slippage math, hook flag, crypto-backup, RPC proxy.
- `pnpm preflight:mainnet` hijau dengan bypass IP.
- E2E mainnet nilai kecil (0.001 ETH deposit → withdraw ke fresh address) via script dengan env wallet, verifikasi `nextIndex+1`, `nullifierUsed`, `totalDeposits-totalWithdrawn == balance`.
- Verifikasi Blockscout semua 7 alamat.

## 7. Deploy / Ops

- Perbaiki scripts RPC: gunakan `172.66.147.70` + `Host` + UA seperti `app/api/rpc/route.ts`, baca `PRIVATE_KEY` dari `.env.mainnet.local` (jangan hardcoded).
- `scripts/deploy.mjs` hanya dipakai jika perlu redeploy; default pakai `mainnet-latest.json` yang ada + tulis `.env.local` yang benar.
- Post-deploy: `setVeilToken` (jika token Pons sudah ada, kalau belum skip jujur), `setBuybackShareBps(7000)`, opsional `setPoolGating` 10 menit.
- Simpan manifest baru + verifikasi explorer, update README hanya dengan tx real.

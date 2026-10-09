// Live invariant gate (DevBrief §6.9): totalDeposits − totalWithdrawn = pool
// balance, per pool (native ETH + ERC20). Read-only, works on 46630 and 4663.
// Usage: node scripts/verify-pool-invariant.mjs [--mainnet]
// Exit 0 = all invariants hold; non-zero = MISMATCH (do not open deposits).
import { readFileSync } from "node:fs";
import { createPublicClient, custom, formatEther, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet, robinhoodMainnet } from "../lib/chains.mjs";
import { rpcRequest } from "./rpc-helper.mjs";

const MAINNET = process.argv.includes("--mainnet");
const CHAIN_ID = MAINNET ? 4663 : 46630;
const chain = MAINNET ? robinhoodMainnet : robinhoodTestnet;

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(CHAIN_ID, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const client = createPublicClient({ chain, transport: custom(provider) });

const POOL_ABI = parseAbi([
  "function denomination() view returns (uint256)",
  "function asset() view returns (address)",
  "function totalDeposits() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)",
]);
const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL_FALLBACK = "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a";
const BOW_POOL_ABI = parseAbi([
  "function lifetimeDeposited() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Pools under audit, built from deployment manifests (no hardcoded pool
// addresses). Testnet: fresh legacy pools (deployments/legacy-pools-fresh-46630.json)
// + fresh 0xbow v3 suite (deployments/suite-v3-testnet-latest.json).
// Mainnet: written by pnpm migrate:mainnet.
const POOLS = MAINNET
  ? (() => {
      const m = readJson("deployments/privacy-pools-mainnet-latest.json");
      return [
        { name: "Mainnet_0xbow_ETH", address: m.ethPool, kind: "bow", asset: ZERO },
        { name: "Mainnet_0xbow_VEIL", address: m.veilPool, kind: "bow", asset: m.veilToken ?? m.veilTokenAddress ?? VEIL_FALLBACK },
        { name: "Mainnet_Legacy_ETH", address: m.legacyEthPool, kind: "legacy" },
        { name: "Mainnet_Legacy_VEIL05", address: m.veilPool05, kind: "legacy" },
        { name: "Mainnet_Legacy_VEIL2", address: m.veilPool2, kind: "legacy" },
      ];
    })()
  : (() => {
      const legacy = readJson("deployments/legacy-pools-fresh-46630.json");
      const v3 = readJson("deployments/suite-v3-testnet-latest.json");
      return [
        { name: "LegacyPool_ETH(fresh)", address: legacy.pools.eth.address, kind: "legacy" },
        { name: "ShieldedPool_VEIL05(fresh)", address: legacy.pools.veil05.address, kind: "legacy" },
        { name: "ShieldedPool_VEIL2(fresh)", address: legacy.pools.veil2.address, kind: "legacy" },
        { name: "BowV3_ETH", address: v3.ethPool, kind: "bow", asset: ZERO },
        { name: "BowV3_VEIL", address: v3.veilPool, kind: "bow", asset: v3.veilToken },
      ];
    })();

if (Number(await client.getChainId()) !== CHAIN_ID) throw new Error(`Not chain ${CHAIN_ID}, aborting.`);

let failures = 0;
for (const p of POOLS) {
  if (p.kind === "bow") {
    // 0xbow v3 pools expose lifetimeDeposited (no totalDeposits/totalWithdrawn).
    // Gate: onchain balance must never exceed lifetime deposits (withdrawals
    // only move funds out); fail closed on excess.
    const [lifetime, paused] = await Promise.all([
      client.readContract({ address: p.address, abi: BOW_POOL_ABI, functionName: "lifetimeDeposited" }),
      client.readContract({ address: p.address, abi: BOW_POOL_ABI, functionName: "depositsPaused" }),
    ]);
    const balance =
      p.asset === ZERO
        ? await client.getBalance({ address: p.address })
        : await client.readContract({ address: p.asset, abi: ERC20_ABI, functionName: "balanceOf", args: [p.address] });
    const ok = balance <= lifetime;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "MISMATCH"} ${p.name}: lifetime=${formatEther(lifetime)} balance=${formatEther(balance)} paused=${paused}`
    );
    continue;
  }
  const [denom, asset, tot, wd] = await Promise.all([
    client.readContract({ address: p.address, abi: POOL_ABI, functionName: "denomination" }),
    client.readContract({ address: p.address, abi: POOL_ABI, functionName: "asset" }),
    client.readContract({ address: p.address, abi: POOL_ABI, functionName: "totalDeposits" }),
    client.readContract({ address: p.address, abi: POOL_ABI, functionName: "totalWithdrawn" }),
  ]);
  const expected = tot - wd;
  const balance =
    asset === ZERO
      ? await client.getBalance({ address: p.address })
      : await client.readContract({ address: asset, abi: ERC20_ABI, functionName: "balanceOf", args: [p.address] });
  const ok = balance === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "MISMATCH"} ${p.name}: denom=${formatEther(denom)} total=${formatEther(tot)} ` +
      `withdrawn=${formatEther(wd)} expected=${formatEther(expected)} balance=${formatEther(balance)}`
  );
}
if (failures > 0) {
  console.error(`INVARIANT FAILED on ${failures} pool(s). Do not open deposits.`);
  process.exit(1);
}
console.log(`INVARIANT OK — all ${POOLS.length} pool(s) on chain ${CHAIN_ID}.`);

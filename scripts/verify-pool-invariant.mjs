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

function loadManifest() {
  const path = MAINNET
    ? "deployments/privacy-pools-mainnet-latest.json"
    : "deployments/router-fixed-testnet-latest.json";
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// Legacy pools under audit. Testnet: fixed manifest set. Mainnet: written by
// pnpm migrate:mainnet (veilPool05/veilPool2) plus the pre-existing Mock ETH
// pool (paused, must read zero-drift too).
const POOLS = MAINNET
  ? [
      { name: "LegacyPool_ETH(Mock,paused)", address: process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH || "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0" },
    ]
  : [
      { name: "LegacyPool_ETH", address: "0x1b1d39e4da649747ecc0e93e7a06452a3061de17" },
      { name: "ShieldedPool_VEIL05", address: "0xd73920a3cbfdf3f6be530cab73fc9c876619517a" },
      { name: "ShieldedPool_VEIL2", address: "0x172e9cc542cf9349813f74548eec6e0a1df65e17" },
    ];

if (Number(await client.getChainId()) !== CHAIN_ID) throw new Error(`Not chain ${CHAIN_ID}, aborting.`);

let failures = 0;
for (const p of POOLS) {
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

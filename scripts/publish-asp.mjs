// Publishes the association set per docs/ASP-POLICY.md: every onchain
// deposit label plus the genesis sentinel, no human judgment.
// Usage: ENTRYPOINT=0x.. POOLS=0xaa,0xbb CHAIN=46630 node scripts/publish-asp.mjs
// Uses PRIVATE_KEY from env (must hold the postman role). Never mainnet
// unless CHAIN=4663 is passed explicitly.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet, robinhoodMainnet } from "../lib/chains.mjs";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import { rpcRequest } from "./rpc-helper.mjs";

function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const CHAIN = BigInt(process.env.CHAIN ?? "46630");
const ENTRYPOINT = process.env.ENTRYPOINT ?? "";
const POOLS = (process.env.POOLS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (!/^0x[0-9a-fA-F]{40}$/.test(ENTRYPOINT) || POOLS.length === 0) {
  throw new Error("Set ENTRYPOINT=0x.. and POOLS=0xaa,0xbb (CHAIN=46630|4663).");
}
if (CHAIN !== 46630n && CHAIN !== 4663n) throw new Error("CHAIN must be 46630 or 4663.");
const key = (process.env.PRIVATE_KEY ?? "").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set PRIVATE_KEY in env.");
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(Number(CHAIN), { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const chain = CHAIN === 4663n ? robinhoodMainnet : robinhoodTestnet;
const transport = custom(provider);
const publicClient = createPublicClient({ chain, transport });
const account = privateKeyToAccount(key);
const wallet = createWalletClient({ account, chain, transport });
const poolAbi = [
  { type: "event", name: "Deposited", inputs: [{ name: "_depositor", type: "address", indexed: true }, { name: "_commitment", type: "uint256" }, { name: "_label", type: "uint256" }, { name: "_value", type: "uint256" }, { name: "_precommitmentHash", type: "uint256" }] },
];
const epAbi = [
  { type: "function", name: "updateRoot", stateMutability: "nonpayable", inputs: [{ name: "_root", type: "uint256" }, { name: "_ipfsCID", type: "string" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "latestRoot", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
];

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const head = await publicClient.getBlockNumber();
const labels = new Set([SNARK_FIELD - 1n]);
// Full-history scan in RPC-safe chunks: omitting old labels would censor
// dormant depositors, so partial ranges are not acceptable here.
const CHUNK = 5000000n;
for (const pool of POOLS) {
  for (let to = head; to > 0n; to -= CHUNK) {
    const from = to - CHUNK > 0n ? to - CHUNK : 0n;
    const logs = await publicClient.getContractEvents({ address: pool, abi: poolAbi, eventName: "Deposited", fromBlock: from, toBlock: to });
    for (const l of logs) labels.add(BigInt(l.args._label));
    if (from === 0n) break;
  }
}
const sorted = [...labels].sort((a, b) => (a < b ? -1 : 1));
const aspRoot = BigInt(generateMerkleProof(sorted, sorted[0]).root);
const onchain = await publicClient.readContract({ address: ENTRYPOINT, abi: epAbi, functionName: "latestRoot" });
console.log(`labels: ${sorted.length}, recomputed: ${aspRoot}, onchain: ${onchain}`);
if (aspRoot === onchain) {
  console.log("ASP already current, nothing to publish.");
  process.exit(0);
}
const h = await wallet.writeContract({ address: ENTRYPOINT, abi: epAbi, functionName: "updateRoot", args: [aspRoot, `auto-asp-${CHAIN}-labels-${sorted.length}`.padEnd(33, "0")] });
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("updateRoot reverted");
console.log("ASP published:", h, aspRoot.toString());

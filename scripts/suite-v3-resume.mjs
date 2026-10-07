// TESTNET ONLY (46630). Resumes suite-v3: activate, register, ASP.
// Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import { rpcRequest } from "./rpc-helper.mjs";

const root = process.cwd();
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

const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ENTRYPOINT = "0xdc473a2fb03585e8870baaf2d4742b2643de300d";
const ETH_POOL = "0xf0bdd4cbfcde05b11f401e4b9b3cb6664cbb31ef";
const VEIL_POOL = "0x23e9008294ab74875aa3f9cdcd42511bb43c7ed6";
const key = (process.env.PRIVATE_KEY ?? "").trim();
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain: robinhoodTestnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport });
const art = (n) => JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", `${n}.json`), "utf8"));
const epAbi = art("Entrypoint").abi;
const poolAbi = art("VeilTestnetPrivacyPool").abi;

async function call(addr, abi, fn, args) {
  const h = await wallet.writeContract({ address: addr, abi, functionName: fn, args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`${fn} reverted: ${h}`);
  console.log(`${fn}:`, h);
  return h;
}
const pauseAbi = [{ type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }];
for (const p of [ETH_POOL, VEIL_POOL]) {
  const paused = await publicClient.readContract({ address: p, abi: pauseAbi, functionName: "depositsPaused" });
  if (!paused) {
    console.log("already active:", p);
    continue;
  }
  await call(p, poolAbi, "activateDeposits", []);
}
for (const [asset, pool, min] of [[ETH, ETH_POOL, parseEther("0.001")], [VEIL, VEIL_POOL, parseEther("1")]]) {
  try {
    await call(ENTRYPOINT, epAbi, "registerPool", [asset, pool, min, 0n, 100n]);
  } catch (e) {
    console.log(`register skipped for ${pool} (probably exists):`, e.message.slice(0, 100));
  }
}

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
await call(ENTRYPOINT, epAbi, "updateRoot", [aspRoot, "local-v3-asp-46630-sentinel-0000"]);

const out = {
  chainId: 46630, entrypoint: ENTRYPOINT, ethPool: ETH_POOL, veilPool: VEIL_POOL, veilToken: VEIL,
  aspRoot: aspRoot.toString(), owner: account.address, maxRelayFeeBPS: 100,
};
writeFileSync(join(root, "deployments", "suite-v3-testnet-latest.json"), JSON.stringify(out, null, 2));
console.log("SUITE V3 COMPLETE");

// TESTNET ONLY (46630). Resumes suite-v2: redeploys the fixed VEIL pool,
// activates, registers both pools, sets ASP. Never mainnet.
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
const ETH = "0x0000000000000000000000000000000000000000";
const ENTRYPOINT = "0x5409b34074a4da5d1f11a88df40fd60556d853cc";
const ETH_POOL = "0x979763c3961ae6a0dbf61223ad7efb7a83b4b341";
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
const old = JSON.parse(readFileSync(join(root, "deployments", "privacy-pools-testnet-latest.json"), "utf8"));

const POSEIDON = {
  "node_modules/poseidon-solidity/PoseidonT3.sol:PoseidonT3": "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34",
  "node_modules/poseidon-solidity/PoseidonT4.sol:PoseidonT4": "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
};
function link(bytecode, linkReferences) {
  let code = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  for (const [file, names] of Object.entries(linkReferences ?? {})) {
    for (const [name, refs] of Object.entries(names)) {
      const addr = POSEIDON[`${file}:${name}`];
      if (!addr) throw new Error(`No Poseidon address for ${file}:${name}`);
      for (const r of refs) {
        code = code.slice(0, r.start * 2) + addr.slice(2).toLowerCase() + code.slice(r.start * 2 + r.length * 2);
      }
    }
  }
  return `0x${code}`;
}
const epAbi = art("Entrypoint").abi;
const erc20Art = art("VeilTestnetPrivacyPoolERC20");
let h = await wallet.deployContract({
  abi: erc20Art.abi,
  bytecode: link(erc20Art.bytecode, erc20Art.linkReferences),
  args: [ENTRYPOINT, old.contracts.withdrawalVerifier.address, old.contracts.commitmentVerifier.address, VEIL, account.address],
});
let rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("veil pool deploy reverted");
const veilPool = rc.contractAddress;
console.log("veil pool:", veilPool, h);
const g = await publicClient.readContract({ address: veilPool, abi: art("VeilTestnetPrivacyPoolERC20").abi, functionName: "guardian" });
console.log("guardian:", g);
if (g.toLowerCase() !== account.address.toLowerCase()) throw new Error("guardian not set");

const poolAbi = art("VeilTestnetPrivacyPool").abi;
for (const p of [ETH_POOL, veilPool]) {
  try {
    h = await wallet.writeContract({ address: p, abi: poolAbi, functionName: "activateDeposits", args: [] });
    rc = await publicClient.waitForTransactionReceipt({ hash: h });
    if (rc.status !== "success") throw new Error(`activate reverted for ${p}`);
    console.log("activated:", p);
  } catch (e) {
    console.log(`activate skipped for ${p} (probably already active):`, e.message.slice(0, 80));
  }
}
console.log("both pools activated");

for (const [asset, pool, min] of [[ETH, ETH_POOL, parseEther("0.001")], [VEIL, veilPool, parseEther("1")]]) {
  try {
    h = await wallet.writeContract({ address: ENTRYPOINT, abi: epAbi, functionName: "registerPool", args: [asset, pool, min, 0n, 100n] });
    rc = await publicClient.waitForTransactionReceipt({ hash: h });
    if (rc.status !== "success") throw new Error("register reverted");
    console.log("registered:", asset === ETH ? "ETH" : "VEIL");
  } catch (e) {
    console.log(`register skipped (probably exists):`, e.message.slice(0, 100));
  }
}
console.log("both pools registered (maxRelayFeeBPS=100)");

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
h = await wallet.writeContract({ address: ENTRYPOINT, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v2-asp-46630-sentinel"] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("ASP root set");

const out = {
  chainId: 46630, entrypoint: ENTRYPOINT, ethPool: ETH_POOL, veilPool, veilToken: VEIL,
  withdrawalVerifier: old.contracts.withdrawalVerifier.address,
  commitmentVerifier: old.contracts.commitmentVerifier.address,
  aspRoot: aspRoot.toString(), owner: account.address, maxRelayFeeBPS: 100,
};
writeFileSync(join(root, "deployments", "suite-v2-testnet-latest.json"), JSON.stringify(out, null, 2));
console.log("SUITE V2 COMPLETE");

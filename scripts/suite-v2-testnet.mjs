// TESTNET ONLY (46630). Deploys a fresh 0xbow suite v2 fully owned by the
// operator: entrypoint + ETH pool + VEIL pool, maxRelayFeeBPS=100,
// sentinel ASP. Never mainnet.
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
async function deploy(name, args = []) {
  const a = art(name);
  const h = await wallet.deployContract({ abi: a.abi, bytecode: link(a.bytecode, a.linkReferences), args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`${name} deploy reverted`);
  console.log(`${name}:`, rc.contractAddress, h);
  return rc.contractAddress;
}

const wdr = old.contracts.withdrawalVerifier.address;
const cmt = old.contracts.commitmentVerifier.address;
const epImpl = await deploy("Entrypoint");
// NOTE: ERC1967Proxy plumbing proved unreliable here; use the
// implementation directly as entrypoint (testnet only, no upgrades needed).
const entrypoint = epImpl;
console.log("entrypoint (direct impl):", entrypoint);
let h;

const epAbi = art("Entrypoint").abi;
h = await wallet.writeContract({ address: entrypoint, abi: epAbi, functionName: "initialize", args: [account.address, account.address] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("entrypoint initialized, owner+postman =", account.address);

const ethPool = await deploy("VeilTestnetPrivacyPool", [entrypoint, wdr, cmt, account.address]);
const veilPool = await deploy("VeilTestnetPrivacyPoolERC20", [entrypoint, wdr, cmt, VEIL, account.address]);

const poolAbi = art("VeilTestnetPrivacyPool").abi;
for (const p of [ethPool, veilPool]) {
  h = await wallet.writeContract({ address: p, abi: poolAbi, functionName: "activateDeposits", args: [] });
  await publicClient.waitForTransactionReceipt({ hash: h });
}
console.log("both pools activated");

h = await wallet.writeContract({ address: entrypoint, abi: epAbi, functionName: "registerPool", args: [ETH, ethPool, parseEther("0.001"), 0n, 100n] });
await publicClient.waitForTransactionReceipt({ hash: h });
h = await wallet.writeContract({ address: entrypoint, abi: epAbi, functionName: "registerPool", args: [VEIL, veilPool, parseEther("1"), 0n, 100n] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("both pools registered (maxRelayFeeBPS=100)");

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
h = await wallet.writeContract({ address: entrypoint, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v2-asp-46630-sentinel"] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("ASP root set:", aspRoot.toString());

const out = {
  chainId: 46630, entrypoint, ethPool, veilPool, veilToken: VEIL,
  withdrawalVerifier: wdr, commitmentVerifier: cmt, aspRoot: aspRoot.toString(),
  owner: account.address, maxRelayFeeBPS: 100,
};
writeFileSync(join(root, "deployments", "suite-v2-testnet-latest.json"), JSON.stringify(out, null, 2));
console.log("SUITE V2 DEPLOYED");

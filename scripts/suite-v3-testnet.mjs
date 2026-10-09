// TESTNET ONLY (46630). Fresh 0xbow suite: entrypoint (proxy + init data
// in constructor, v1 pattern) + ETH pool + VEIL pool, maxRelayFeeBPS=100.
// Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, parseEther } from "viem";
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
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // 0xbow NATIVE_ASSET (NOT address(0))
const POSEIDON = {
  "node_modules/poseidon-solidity/PoseidonT3.sol:PoseidonT3": "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34",
  "node_modules/poseidon-solidity/PoseidonT4.sol:PoseidonT4": "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
};
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

if (Number(await publicClient.getChainId()) !== 46630) throw new Error("Not testnet 46630, aborting (refusing to deploy v3 suite elsewhere).");

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
  if (code.includes("$")) throw new Error("Unresolved library links.");
  return `0x${code}`;
}
async function deploy(name, args) {
  const a = art(name);
  const code = link(a.bytecode, a.linkReferences);
  if (code.includes("$")) throw new Error(`Unresolved links in ${name}`);
  const h = await wallet.deployContract({ abi: a.abi, bytecode: code, args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success" || !rc.contractAddress) throw new Error(`${name} deploy reverted: ${h}`);
  console.log(`${name}:`, rc.contractAddress, h);
  return rc.contractAddress;
}
async function call(addr, abi, fn, args) {
  const h = await wallet.writeContract({ address: addr, abi, functionName: fn, args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`${fn} reverted: ${h}`);
  console.log(`${fn}:`, h);
  return h;
}

const wdr = "0xeea9d0f7ee0958c6d59f25162be4e69ba60a0f71";
const cmt = "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008";
const epImpl = await deploy("Entrypoint", []);
const epAbi = art("Entrypoint").abi;
const initData = encodeFunctionData({ abi: epAbi, functionName: "initialize", args: [account.address, account.address] });
const proxy = await deploy("ERC1967Proxy", [epImpl, initData]);
const entrypoint = proxy;
console.log("entrypoint (proxy, initialized in construction):", entrypoint);

const poolAbi = art("VeilTestnetPrivacyPool").abi;
const erc20Abi = art("VeilTestnetPrivacyPoolERC20").abi;
const ethPool = await deploy("VeilTestnetPrivacyPool", [entrypoint, wdr, cmt, account.address]);
const veilPool = await deploy("VeilTestnetPrivacyPoolERC20", [entrypoint, wdr, cmt, VEIL, account.address]);
await call(ethPool, poolAbi, "activateDeposits", []);
await call(veilPool, erc20Abi, "activateDeposits", []);
await call(entrypoint, epAbi, "registerPool", [ETH, ethPool, parseEther("0.001"), 0n, 100n]);
await call(entrypoint, epAbi, "registerPool", [VEIL, veilPool, parseEther("1"), 0n, 100n]);

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
// CID must be 32-64 chars (Entrypoint reverts InvalidIPFSCIDLength otherwise).
const aspCid = "local-v3-asp-46630-sentinel-00000000";
await call(entrypoint, epAbi, "updateRoot", [aspRoot, aspCid]);

const out = {
  chainId: 46630, entrypoint, ethPool, veilPool, veilToken: VEIL,
  withdrawalVerifier: wdr, commitmentVerifier: cmt, aspRoot: aspRoot.toString(),
  owner: account.address, maxRelayFeeBPS: 100,
};
writeFileSync(join(root, "deployments", "suite-v3-testnet-latest.json"), JSON.stringify(out, null, 2));
console.log("SUITE V3 COMPLETE");

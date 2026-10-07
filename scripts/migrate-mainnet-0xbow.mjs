// MAINNET 4663. Deploys the audited 0xbow v1.2.1 suite on mainnet using the
// EXACT contracts proven on testnet: verifiers, entrypoint (proxy + init in
// constructor), ETH pool + VEIL pool, ASP sentinel, maxRelayFeeBPS=100.
// Quinn: needs ~0.0003 ETH gas + 0.0011 for the proof cycle. Fund first.
// Usage: node scripts/migrate-mainnet-0xbow.mjs --execute
// Without --execute: dry-run validation only (zero gas).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet } from "../lib/chains.mjs";
import { generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
import { rpcRequest } from "./rpc-helper.mjs";

const root = process.cwd();
const EXECUTE = process.argv.includes("--execute");
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

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const VEIL = process.env.NEXT_PUBLIC_VEIL_TOKEN || "0xe0e11ec0d62eda12de796d025d6334fadfe5ab2a";
const key = (process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY || "").trim();
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env.");
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(4663, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain: robinhoodMainnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodMainnet, transport });
const art = (n) => JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", `${n}.json`), "utf8"));

if (Number(await publicClient.getChainId()) !== 4663) throw new Error("Not mainnet 4663, aborting.");
const bal = await publicClient.getBalance({ address: account.address });
console.log("deployer:", account.address, "balance:", formatEther(bal), "execute:", EXECUTE);
if (EXECUTE && bal < parseEther("0.0015")) throw new Error("Need >= 0.0015 ETH for full migration + proof. Fund first.");

const libs = {};
async function deployLibrary(name) {
  const a = art(name);
  const send = async () => {
    const h = await wallet.writeContract({ abi: a.abi, bytecode: `0x${a.bytecode}`, args: [] });
    const rc = await publicClient.waitForTransactionReceipt({ hash: h });
    if (rc.status !== "success") throw new Error(`${name} deploy reverted`);
    return rc.contractAddress;
  };
  if (!EXECUTE) {
    console.log(`[dry-run] would deploy ${name}`);
    return `0x${"11".repeat(20)}`;
  }
  const addr = await send();
  console.log(`${name}:`, addr);
  return addr;
}
function link(bytecode, linkReferences) {
  let code = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  for (const [file, names] of Object.entries(linkReferences ?? {})) {
    for (const [name, refs] of Object.entries(names)) {
      const addr = libs[name];
      if (!addr) throw new Error(`No address for library ${name}`);
      for (const r of refs) {
        code = code.slice(0, r.start * 2) + addr.slice(2).toLowerCase() + code.slice(r.start * 2 + r.length * 2);
      }
    }
  }
  if (code.includes("$")) throw new Error("Unresolved library links.");
  return `0x${code}`;
}
async function deploy(name, args = []) {
  const a = art(name);
  if (!EXECUTE) {
    console.log(`[dry-run] would deploy ${name} with ${args.length} args`);
    return `0x${"22".repeat(20)}`;
  }
  const h = await wallet.deployContract({ abi: a.abi, bytecode: link(a.bytecode, a.linkReferences), args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success" || !rc.contractAddress) throw new Error(`${name} deploy reverted`);
  console.log(`${name}:`, rc.contractAddress);
  return rc.contractAddress;
}
async function call(addr, abi, fn, args) {
  if (!EXECUTE) {
    console.log(`[dry-run] would call ${fn} on ${addr.slice(0, 10)}`);
    return "0x" + "00".repeat(32);
  }
  const h = await wallet.writeContract({ address: addr, abi, functionName: fn, args });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`${fn} reverted: ${h}`);
  console.log(`${fn}:`, h);
  return h;
}

libs.PoseidonT3 = await deployLibrary("PoseidonT3");
libs.PoseidonT4 = await deployLibrary("PoseidonT4");
const wdr = await deploy("WithdrawalVerifier", []);
const cmt = await deploy("CommitmentVerifier", []);
const epImpl = await deploy("Entrypoint", []);
const epAbi = art("Entrypoint").abi;
const initData = encodeFunctionData({ abi: epAbi, functionName: "initialize", args: [account.address, account.address] });
const entrypoint = await deploy("ERC1967Proxy", [epImpl, initData]);
const poolAbi = art("VeilTestnetPrivacyPool").abi;
const erc20Abi = art("VeilTestnetPrivacyPoolERC20").abi;
const ethPool = await deploy("VeilTestnetPrivacyPool", [entrypoint, wdr, cmt, account.address]);
const veilPool = await deploy("VeilTestnetPrivacyPoolERC20", [entrypoint, wdr, cmt, VEIL, account.address]);
await call(ethPool, poolAbi, "activateDeposits", []);
await call(veilPool, erc20Abi, "activateDeposits", []);
await call(entrypoint, epAbi, "registerPool", [NATIVE, ethPool, parseEther("0.001"), 0n, 100n]);
await call(entrypoint, epAbi, "registerPool", [VEIL, veilPool, parseEther("1"), 0n, 100n]);

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
await call(entrypoint, epAbi, "updateRoot", [aspRoot, "local-mainnet-asp-sentinel-00000000"]);

const TREASURY_MAINNET = process.env.NEXT_PUBLIC_VEIL_TREASURY || "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34";
const CREATE2_MAINNET = process.env.NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER || "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008";
const V4_PM_MAINNET = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
let registryV2 = `0x${"33".repeat(20)}`;
let hookV2 = `0x${"44".repeat(20)}`;
let hookSalt = `0x${"00".repeat(32)}`;
if (!EXECUTE) {
  console.log("[dry-run] would deploy VeilAttestationRegistry + mine/deploy VeilHook v2");
} else {
  const { VEIL_ATTESTATION_REGISTRY_ABI, VEIL_ATTESTATION_REGISTRY_BYTECODE, VEIL_HOOK_ABI, VEIL_HOOK_BYTECODE, VEIL_CREATE2_DEPLOYER_ABI } =
    await import("../lib/veil-artifact.mjs");
  const { mineHookSalt } = await import("./mine-hook.mjs");
  const { encodeAbiParameters: enc } = await import("viem");
  let hh = await wallet.deployContract({ abi: VEIL_ATTESTATION_REGISTRY_ABI, bytecode: VEIL_ATTESTATION_REGISTRY_BYTECODE, args: [account.address] });
  let rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
  if (rrc.status !== "success") throw new Error("registry v2 deploy reverted");
  registryV2 = rrc.contractAddress;
  console.log("registry v2:", registryV2);
  const mined = mineHookSalt(CREATE2_MAINNET, V4_PM_MAINNET, TREASURY_MAINNET, registryV2, account.address);
  hookSalt = mined.salt;
  hookV2 = mined.address;
  const ctor = enc(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { name: "o", type: "address" }],
    [V4_PM_MAINNET, TREASURY_MAINNET, registryV2, account.address]
  ).slice(2);
  hh = await wallet.writeContract({ address: CREATE2_MAINNET, abi: VEIL_CREATE2_DEPLOYER_ABI, functionName: "deploy", args: [hookSalt, `${VEIL_HOOK_BYTECODE}${ctor}`] });
  rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
  if (rrc.status !== "success") throw new Error("hook v2 deploy reverted");
  console.log("hook v2:", hookV2);
}

if (!EXECUTE) {
  console.log("DRY-RUN COMPLETE — no gas spent. Re-run with --execute once funded.");
  process.exit(0);
}
const out = {
  chainId: 4663, entrypoint, ethPool, veilPool, veilToken: VEIL,
  withdrawalVerifier: wdr, commitmentVerifier: cmt,
  poseidonT3: libs.PoseidonT3, poseidonT4: libs.PoseidonT4,
  registryV2, hookV2, hookSalt, treasury: TREASURY_MAINNET,
  aspRoot: aspRoot.toString(), owner: account.address, maxRelayFeeBPS: 100,
};
writeFileSync(join(root, "deployments", "privacy-pools-mainnet-latest.json"), JSON.stringify(out, null, 2));
for (const f of [".env.local", ".env.mainnet.local"]) {
  if (!existsSync(f)) continue;
  let txt = readFileSync(f, "utf8");
  const set = (k, v) => {
    if (new RegExp(`^${k}=`, "m").test(txt)) txt = txt.replace(new RegExp(`^${k}=.*`, "m"), `${k}=${v}`);
    else txt += `\n${k}=${v}`;
  };
  set("NEXT_PUBLIC_0XBOW_ENTRYPOINT", entrypoint);
  set("NEXT_PUBLIC_0XBOW_POOL_ETH", ethPool);
  set("NEXT_PUBLIC_0XBOW_POOL_VEIL", veilPool);
  set("NEXT_PUBLIC_VEIL_ATTESTATION_REGISTRY", registryV2);
  set("NEXT_PUBLIC_VEIL_HOOK", hookV2);
  writeFileSync(f, txt);
  console.log("env updated:", f);
}
console.log("MAINNET 0XBOW MIGRATION COMPLETE");

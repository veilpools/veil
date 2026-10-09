// MAINNET 4663. Deploys the audited 0xbow v1.2.1 suite on mainnet using the
// EXACT contracts proven on testnet: verifiers, entrypoint (proxy + init in
// constructor), ETH pool + VEIL pool, ASP sentinel, maxRelayFeeBPS=100.
// Plus full testnet parity for the legacy path: fixed VeilShieldRouter (R1
// native-settle fix) and legacy ShieldedPool VEIL 0.5 / 2 (Mock verifier,
// mirroring the mainnet ETH pool config — provisional, like testnet).
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

const CHECKPOINT = join(root, "deployments", "migrate-mainnet-pending.json");
let checkpoint = {};
try {
  checkpoint = JSON.parse(readFileSync(CHECKPOINT, "utf8"));
} catch {}
const saveCheckpoint = () =>
  writeFileSync(CHECKPOINT, JSON.stringify({ ...checkpoint, updatedAt: new Date().toISOString() }, null, 2));
async function codeExists(addr) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr ?? "")) return false;
  const code = await publicClient.getCode({ address: addr });
  return !!code && code !== "0x";
}
const outputExists = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

libs.PoseidonT3 = checkpoint.poseidonT3 && (await codeExists(checkpoint.poseidonT3)) ? checkpoint.poseidonT3 : await deployLibrary("PoseidonT3");
libs.PoseidonT4 = checkpoint.poseidonT4 && (await codeExists(checkpoint.poseidonT4)) ? checkpoint.poseidonT4 : await deployLibrary("PoseidonT4");
checkpoint.poseidonT3 = libs.PoseidonT3;
checkpoint.poseidonT4 = libs.PoseidonT4;
saveCheckpoint();
const wdr = outputExists(checkpoint.wdr) && (await codeExists(checkpoint.wdr)) ? checkpoint.wdr : await deploy("WithdrawalVerifier", []);
const cmt = outputExists(checkpoint.cmt) && (await codeExists(checkpoint.cmt)) ? checkpoint.cmt : await deploy("CommitmentVerifier", []);
checkpoint.wdr = wdr;
checkpoint.cmt = cmt;
saveCheckpoint();
const epImpl = outputExists(checkpoint.epImpl) && (await codeExists(checkpoint.epImpl)) ? checkpoint.epImpl : await deploy("Entrypoint", []);
checkpoint.epImpl = epImpl;
saveCheckpoint();
const epAbi = art("Entrypoint").abi;
const initData = encodeFunctionData({ abi: epAbi, functionName: "initialize", args: [account.address, account.address] });
const entrypoint = outputExists(checkpoint.entrypoint) && (await codeExists(checkpoint.entrypoint)) ? checkpoint.entrypoint : await deploy("ERC1967Proxy", [epImpl, initData]);
const entrypointFresh = checkpoint.entrypoint !== entrypoint && EXECUTE;
checkpoint.entrypoint = entrypoint;
if (entrypointFresh) {
  delete checkpoint.ethPool;
  delete checkpoint.veilPool;
  delete checkpoint.registryV2;
  delete checkpoint.hookV2;
}
saveCheckpoint();
const poolAbi = art("VeilTestnetPrivacyPool").abi;
const erc20Abi = art("VeilTestnetPrivacyPoolERC20").abi;
const ethPool = outputExists(checkpoint.ethPool) && (await codeExists(checkpoint.ethPool)) ? checkpoint.ethPool : await deploy("VeilTestnetPrivacyPool", [entrypoint, wdr, cmt, account.address]);
const veilPool = outputExists(checkpoint.veilPool) && (await codeExists(checkpoint.veilPool)) ? checkpoint.veilPool : await deploy("VeilTestnetPrivacyPoolERC20", [entrypoint, wdr, cmt, VEIL, account.address]);
checkpoint.ethPool = ethPool;
checkpoint.veilPool = veilPool;
saveCheckpoint();
const pauseAbi = [{ type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }];
for (const [p, a] of [[ethPool, poolAbi], [veilPool, erc20Abi]]) {
  const paused = EXECUTE ? await publicClient.readContract({ address: p, abi: pauseAbi, functionName: "depositsPaused" }) : true;
  if (paused) await call(p, a, "activateDeposits", []);
  else console.log("already active:", p);
}
try {
  await call(entrypoint, epAbi, "registerPool", [NATIVE, ethPool, parseEther("0.001"), 0n, 100n]);
} catch (e) {
  console.log("registerPool ETH skipped (probably exists):", e.message.slice(0, 90));
}
try {
  await call(entrypoint, epAbi, "registerPool", [VEIL, veilPool, parseEther("1"), 0n, 100n]);
} catch (e) {
  console.log("registerPool VEIL skipped (probably exists):", e.message.slice(0, 90));
}

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const leaves = [SNARK_FIELD - 1n];
const aspRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
await call(entrypoint, epAbi, "updateRoot", [aspRoot, "local-mainnet-asp-sentinel-00000000"]);

// ---- Full-fresh mainnet suite: the old Mock suite (Mock 0x797e, ETH pool
// 0xdd0f paused, treasury 0x8cd3 holding ~145.8k stranded VEIL, create2
// 0xe4c3, hook 0x9df0, router 0x01a0 buggy) is ABANDONED. Nothing is reused:
// fresh treasury, create2, Mock, legacy ETH pool, router, VEIL pools.
const V4_PM_MAINNET = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const ZERO_ASSET = "0x0000000000000000000000000000000000000000";
const FRESH_ASSOC_ROOT =
  "0x2188824287183927522224640574525727508854836440041603434369820418";
const OLD_TREASURY_MAINNET = "0x8cd39f9195bd00b193a164f0790f3fc0dc4f3b34";
let treasuryFresh = `0x${"88".repeat(20)}`;
let create2Fresh = `0x${"99".repeat(20)}`;
let mockFresh = `0x${"aa".repeat(20)}`;
let legacyEthFresh = `0x${"bb".repeat(20)}`;
if (!EXECUTE) {
  console.log("[dry-run] would rescue stranded VEIL from old treasury + deploy fresh VeilTreasury/Create2Deployer/Mock/legacy-ETH-pool");
} else {
  const {
    VEIL_TREASURY_ABI,
    VEIL_TREASURY_BYTECODE,
    VEIL_CREATE2_DEPLOYER_ABI,
    VEIL_CREATE2_DEPLOYER_BYTECODE,
    SHIELDED_VERIFIER_MOCK_ABI,
    SHIELDED_VERIFIER_MOCK_BYTECODE,
    SHIELDED_POOL_ABI,
    SHIELDED_POOL_BYTECODE,
  } = await import("../lib/veil-artifact.mjs");
  try {
    const erc20bal = [
      { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    ];
    const stranded = await publicClient.readContract({
      address: VEIL,
      abi: erc20bal,
      functionName: "balanceOf",
      args: [OLD_TREASURY_MAINNET],
    });
    if (stranded > 0n) {
      await call(OLD_TREASURY_MAINNET, VEIL_TREASURY_ABI, "rescue", [VEIL, account.address, stranded]);
      console.log("rescued stranded VEIL from old treasury:", stranded.toString());
    } else {
      console.log("old treasury empty, nothing to rescue");
    }
  } catch (e) {
    console.log("rescue skipped:", String(e.message || e).slice(0, 120));
  }
  const deployFresh = async (key, abi, bytecode, args) => {
    if (outputExists(checkpoint[key]) && (await codeExists(checkpoint[key]))) {
      console.log(`${key} (resumed):`, checkpoint[key]);
      return checkpoint[key];
    }
    const hh = await wallet.deployContract({ abi, bytecode, args });
    const rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
    if (rrc.status !== "success" || !rrc.contractAddress) throw new Error(`${key} deploy reverted`);
    checkpoint[key] = rrc.contractAddress;
    saveCheckpoint();
    console.log(`${key}:`, rrc.contractAddress);
    return rrc.contractAddress;
  };
  treasuryFresh = await deployFresh("treasuryFresh", VEIL_TREASURY_ABI, VEIL_TREASURY_BYTECODE, [account.address, VEIL]);
  create2Fresh = await deployFresh("create2Fresh", VEIL_CREATE2_DEPLOYER_ABI, VEIL_CREATE2_DEPLOYER_BYTECODE, []);
  mockFresh = await deployFresh("mockFresh", SHIELDED_VERIFIER_MOCK_ABI, SHIELDED_VERIFIER_MOCK_BYTECODE, []);
  legacyEthFresh = await deployFresh("legacyEthFresh", SHIELDED_POOL_ABI, SHIELDED_POOL_BYTECODE, [
    ZERO_ASSET,
    mockFresh,
    parseEther("0.001"),
    parseEther("10"),
    FRESH_ASSOC_ROOT,
    account.address,
  ]);
  const poolVerifyAbi = [
    { type: "function", name: "denomination", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
    { type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  ];
  const [d, a, p] = await Promise.all([
    publicClient.readContract({ address: legacyEthFresh, abi: poolVerifyAbi, functionName: "denomination" }),
    publicClient.readContract({ address: legacyEthFresh, abi: poolVerifyAbi, functionName: "asset" }),
    publicClient.readContract({ address: legacyEthFresh, abi: poolVerifyAbi, functionName: "depositsPaused" }),
  ]);
  if (d !== parseEther("0.001") || a !== ZERO_ASSET || p !== false) throw new Error("legacy ETH pool mismatch after deploy");
  console.log("legacy ETH pool verified: open for deposits");
}
const TREASURY_MAINNET = EXECUTE ? treasuryFresh : (process.env.NEXT_PUBLIC_VEIL_TREASURY || treasuryFresh);
const CREATE2_MAINNET = EXECUTE ? create2Fresh : (process.env.NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER || create2Fresh);
const MOCK_MAINNET = EXECUTE ? mockFresh : (process.env.NEXT_PUBLIC_SHIELDED_VERIFIER || mockFresh);
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
  let hh;
  let rrc;
  if (outputExists(checkpoint.registryV2) && (await codeExists(checkpoint.registryV2))) {
    registryV2 = checkpoint.registryV2;
    console.log("registry v2 (resumed):", registryV2);
  } else {
    hh = await wallet.deployContract({ abi: VEIL_ATTESTATION_REGISTRY_ABI, bytecode: VEIL_ATTESTATION_REGISTRY_BYTECODE, args: [account.address] });
    rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
    if (rrc.status !== "success") throw new Error("registry v2 deploy reverted");
    registryV2 = rrc.contractAddress;
    checkpoint.registryV2 = registryV2;
    saveCheckpoint();
    console.log("registry v2:", registryV2);
  }
  const mined = mineHookSalt(CREATE2_MAINNET, V4_PM_MAINNET, TREASURY_MAINNET, registryV2, account.address);
  hookSalt = mined.salt;
  hookV2 = mined.address;
  const ctor = enc(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { name: "o", type: "address" }],
    [V4_PM_MAINNET, TREASURY_MAINNET, registryV2, account.address]
  ).slice(2);
  if (outputExists(checkpoint.hookV2) && (await codeExists(checkpoint.hookV2))) {
    hookV2 = checkpoint.hookV2;
    hookSalt = checkpoint.hookSalt;
    console.log("hook v2 (resumed):", hookV2);
  } else {
    hh = await wallet.writeContract({ address: CREATE2_MAINNET, abi: VEIL_CREATE2_DEPLOYER_ABI, functionName: "deploy", args: [hookSalt, `${VEIL_HOOK_BYTECODE}${ctor}`] });
    rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
    if (rrc.status !== "success") throw new Error("hook v2 deploy reverted");
    checkpoint.hookV2 = hookV2;
    checkpoint.hookSalt = hookSalt;
    saveCheckpoint();
    console.log("hook v2:", hookV2);
  }
}

// ---- Legacy-path parity with testnet FINAL (router fixed + VEIL pools) ----
const MAINNET_ASSOC_ROOT = FRESH_ASSOC_ROOT;
const MAINNET_MOCK_VERIFIER = MOCK_MAINNET;
let routerFixed = `0x${"55".repeat(20)}`;
let veilPool05 = `0x${"66".repeat(20)}`;
let veilPool2 = `0x${"77".repeat(20)}`;
if (!EXECUTE) {
  console.log("[dry-run] would deploy VeilShieldRouter (fixed R1 settle) + ShieldedPool VEIL 0.5/2");
} else {
  const {
    VEIL_SHIELD_ROUTER_ABI,
    VEIL_SHIELD_ROUTER_BYTECODE,
    SHIELDED_POOL_ABI,
    SHIELDED_POOL_BYTECODE,
  } = await import("../lib/veil-artifact.mjs");
  if (outputExists(checkpoint.routerFixed) && (await codeExists(checkpoint.routerFixed))) {
    routerFixed = checkpoint.routerFixed;
    console.log("router fixed (resumed):", routerFixed);
  } else {
    const hh = await wallet.deployContract({
      abi: VEIL_SHIELD_ROUTER_ABI,
      bytecode: VEIL_SHIELD_ROUTER_BYTECODE,
      args: [V4_PM_MAINNET],
    });
    const rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
    if (rrc.status !== "success" || !rrc.contractAddress) throw new Error("router fixed deploy reverted");
    routerFixed = rrc.contractAddress;
    checkpoint.routerFixed = routerFixed;
    saveCheckpoint();
    console.log("router fixed:", routerFixed);
  }
  const pm = await publicClient.readContract({
    address: routerFixed,
    abi: VEIL_SHIELD_ROUTER_ABI,
    functionName: "poolManager",
  });
  if (pm.toLowerCase() !== V4_PM_MAINNET.toLowerCase()) throw new Error("router poolManager mismatch");
  const poolVerifyAbi = [
    { type: "function", name: "denomination", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "asset", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
    { type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
    { type: "function", name: "poolCap", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "verifier", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  ];
  const deployVeilPool = async (key, denom, cap) => {
    if (outputExists(checkpoint[key]) && (await codeExists(checkpoint[key]))) {
      console.log(`${key} (resumed):`, checkpoint[key]);
      return checkpoint[key];
    }
    const hh = await wallet.deployContract({
      abi: SHIELDED_POOL_ABI,
      bytecode: SHIELDED_POOL_BYTECODE,
      args: [VEIL, MAINNET_MOCK_VERIFIER, denom, cap, MAINNET_ASSOC_ROOT, account.address],
    });
    const rrc = await publicClient.waitForTransactionReceipt({ hash: hh });
    if (rrc.status !== "success" || !rrc.contractAddress) throw new Error(`${key} deploy reverted`);
    const addr = rrc.contractAddress;
    const [d, a, p, c, v] = await Promise.all([
      publicClient.readContract({ address: addr, abi: poolVerifyAbi, functionName: "denomination" }),
      publicClient.readContract({ address: addr, abi: poolVerifyAbi, functionName: "asset" }),
      publicClient.readContract({ address: addr, abi: poolVerifyAbi, functionName: "depositsPaused" }),
      publicClient.readContract({ address: addr, abi: poolVerifyAbi, functionName: "poolCap" }),
      publicClient.readContract({ address: addr, abi: poolVerifyAbi, functionName: "verifier" }),
    ]);
    if (d !== denom) throw new Error(`${key} denomination mismatch after deploy`);
    if (a.toLowerCase() !== VEIL.toLowerCase()) throw new Error(`${key} asset mismatch after deploy`);
    if (p !== false) throw new Error(`${key} deposits must be unpaused after deploy`);
    if (c !== cap) throw new Error(`${key} cap mismatch after deploy`);
    if (v.toLowerCase() !== MAINNET_MOCK_VERIFIER.toLowerCase()) throw new Error(`${key} verifier mismatch after deploy`);
    checkpoint[key] = addr;
    saveCheckpoint();
    console.log(`${key}:`, addr);
    return addr;
  };
  veilPool05 = await deployVeilPool("veilPool05", 500000000000000000n, 5000000000000000000000n);
  veilPool2 = await deployVeilPool("veilPool2", 2000000000000000000n, 20000000000000000000000n);
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
  create2Deployer: CREATE2_MAINNET, mockVerifier: MOCK_MAINNET,
  legacyEthPool: legacyEthFresh,
  routerFixed, veilPool05, veilPool2,
  abandonedOldSuite: {
    mockVerifier: "0x797e2aa1f3225ab38bfc6441a3f4b44e95158cda",
    poolEth: "0xdd0fb7fc7f1398fd1398a594f7a0ce934caa7ea0",
    treasury: OLD_TREASURY_MAINNET,
    create2Deployer: "0xe4c3615db1bdeaf7b82b5568bd73f20f5666f008",
    registry: "0xa7f7e7887a4fa00cc934abe39cdd470cfdc9a855",
    hook: "0x9df0b52bf290a13e11c73c56c4c533e3887760c4",
    router: "0x01a05f87c2c227a1b382cbc2e7e63b186538c86d",
  },
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
  set("NEXT_PUBLIC_VEIL_SHIELD_ROUTER", routerFixed);
  set("NEXT_PUBLIC_VEIL_POOL_05", veilPool05);
  set("NEXT_PUBLIC_VEIL_POOL_2", veilPool2);
  set("NEXT_PUBLIC_VEIL_CREATE2_DEPLOYER", CREATE2_MAINNET);
  set("NEXT_PUBLIC_SHIELDED_VERIFIER", MOCK_MAINNET);
  set("NEXT_PUBLIC_PRIVACY_POOL_ETH", legacyEthFresh);
  set("NEXT_PUBLIC_VEIL_TREASURY", TREASURY_MAINNET);
  writeFileSync(f, txt);
  console.log("env updated:", f);
}
console.log("MAINNET 0XBOW MIGRATION COMPLETE");

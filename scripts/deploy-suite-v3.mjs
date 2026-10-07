// scripts/deploy-privacy-pools-testnet.mjs
// Veil 0xbow Privacy Pools testnet deploy — Robinhood TESTNET 46630 ONLY.
// Routes ALL rpc through scripts/rpc-helper.mjs (Cloudflare IP bypass).
// Never touches mainnet 4663. Never prints keys.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodeFunctionData,
  formatEther,
  keccak256,
  parseEther,
  isAddress,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rpcRequest } from "./rpc-helper.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (key) => (args.includes(key) ? args[args.indexOf(key) + 1] ?? "" : "");

if (!args.includes("--testnet") || !args.includes("--i-understand-testnet-only")) {
  throw new Error("Deployment blocked. Pass --testnet --i-understand-testnet-only (testnet 46630 only).");
}
if (args.includes("--mainnet") || process.env.SHIELD_MAINNET_DEPLOYER_PRIVATE_KEY) {
  throw new Error("Refusing: mainnet flags/keys must never be used in this testnet script.");
}

function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.local");

const key = (process.env.PRIVATE_KEY ?? "").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set PRIVATE_KEY in .env.local to a testnet-only key.");
const account = privateKeyToAccount(key);

const chain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
});

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const pub = createPublicClient({ chain, transport });
const wallet = createWalletClient({ account, chain, transport });

const onchainChainId = Number(await pub.getChainId());
if (onchainChainId !== 46630) throw new Error(`RPC chain id mismatch: expected 46630, got ${onchainChainId}. Aborted.`);

// --- ASP: kentir sentinel is mainnet-pinned (chainId 4663 check in
// kentir scripts/deploy-privacy-pools-mainnet.mjs), so it does NOT validate
// for 46630. Create an honest local/testnet sentinel ASP instead.
const SENTINEL = 21888242871839275222246405745257275088548364400416034343698204186575808495616n;
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
let aspRoot;
let aspCid;
let aspOrigin;
const rootText = arg("--asp-root") || (process.env.SHIELD_ASP_ROOT ?? "").trim();
const cidText = arg("--cid") || (process.env.SHIELD_ASP_CID ?? "").trim();
if (/^\d+$/.test(rootText) && cidText.length >= 32 && cidText.length <= 64) {
  const r = BigInt(rootText);
  if (r <= 0n || r >= SNARK_FIELD) throw new Error("ASP root must be a non-zero BN254 scalar.");
  aspRoot = r;
  aspCid = cidText;
  aspOrigin = "explicit/testnet (operator-provided)";
} else {
  const { generateMerkleProof } = await import("@0xbow/privacy-pools-core-sdk");
  const proof = generateMerkleProof([SENTINEL], SENTINEL);
  const computed = BigInt(proof.root);
  if (computed <= 0n || computed >= SNARK_FIELD) throw new Error("Computed sentinel root out of range.");
  aspRoot = computed;
  // Honest local identifier (Entrypoint only checks 32-64 char length onchain).
  aspCid = "local-testnet-sentinel-46630-v1-0xbow-v1.2.1";
  aspOrigin = "local/testnet (sentinel-only, chainId 46630, snapshotBlock 0, not IPFS-pinned)";
  mkdirSync(join(root, "deployments"), { recursive: true });
  const dataset = {
    schemaVersion: 1,
    protocol: "0xbow-privacy-pools-core-v1.2.1",
    chainId: 46630,
    policy: "Local testnet genesis sentinel only; withdrawals require postman-published labels.",
    snapshotBlock: "0",
    labels: [SENTINEL.toString()],
    root: computed.toString(),
  };
  writeFileSync(join(root, "deployments", "testnet-sentinel-asp-46630.json"), `${JSON.stringify(dataset, null, 2)}\n`);
}

const guardian = arg("--guardian") || process.env.SHIELD_GUARDIAN_ADDRESS || account.address;
if (!isAddress(guardian) || guardian.toLowerCase() === zeroAddress.toLowerCase()) throw new Error("Guardian must be non-zero.");
const postman = account.address; // single-wallet testnet operator = postman
const denomination = parseEther("0.001");

const manifestPath = join(root, "deployments", "privacy-pools-testnet-latest.json");
const checkpointPath = manifestPath.replace(/\.json$/i, ".pending.json");
if (existsSync(manifestPath) && !args.includes("--overwrite-manifest")) {
  throw new Error(`Manifest already exists: ${manifestPath} (pass --overwrite-manifest to replace)`);
}
const artifactDir = join(root, "artifacts", "privacy-pools-testnet");
const artifact = (name) => JSON.parse(readFileSync(join(artifactDir, `${name}.json`), "utf8"));
const checkpoint = existsSync(checkpointPath)
  ? JSON.parse(readFileSync(checkpointPath, "utf8"))
  : {
      schemaVersion: 1,
      chainId: 46630,
      deployer: account.address,
      aspPostman: postman,
      guardian,
      denominationWei: denomination.toString(),
      associationSet: { root: aspRoot.toString(), cid: aspCid, origin: aspOrigin },
      contracts: { libraries: {} },
      transactions: {},
    };
checkpoint.contracts ??= {};
checkpoint.contracts.libraries ??= {};
checkpoint.transactions ??= {};
const saveCheckpoint = () => writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);

async function deployLibrary(name) {
  const saved = checkpoint.contracts.libraries[name];
  if (saved?.address) {
    const code = await pub.getCode({ address: saved.address });
    if (code && code !== "0x") return saved.address;
    throw new Error(`Saved library ${name} has no code; refusing to replace.`);
  }
  const item = artifact(name);
  const hash = await wallet.deployContract({ abi: item.abi, bytecode: item.bytecode, args: [] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deploy failed: ${hash}`);
  const result = { address: receipt.contractAddress, transactionHash: hash, blockNumber: receipt.blockNumber.toString() };
  checkpoint.contracts.libraries[name] = result;
  saveCheckpoint();
  console.log(`${name} deployed: ${result.address} (${hash}) block ${result.blockNumber}`);
  return result.address;
}

async function linkBytecode(item) {
  let object = item.bytecode.slice(2);
  for (const libraries of Object.values(item.linkReferences ?? {})) {
    for (const [name, references] of Object.entries(libraries)) {
      const address = await deployLibrary(name);
      for (const reference of references) {
        const start = reference.start * 2;
        const length = reference.length * 2;
        object = `${object.slice(0, start)}${address.slice(2).toLowerCase()}${object.slice(start + length)}`;
      }
    }
  }
  if (object.includes("__$")) throw new Error("Unresolved library links.");
  return `0x${object}`;
}

async function deploy(name, parameters = [], checkpointKey = name) {
  const saved = checkpoint.contracts[checkpointKey];
  if (saved?.address) {
    const code = await pub.getCode({ address: saved.address });
    if (code && code !== "0x") {
      console.log(`${name} already deployed at ${saved.address}; resuming.`);
      return saved;
    }
    throw new Error(`Saved ${name} has no code; refusing to replace.`);
  }
  const item = artifact(name);
  const bytecode = await linkBytecode(item);
  const hash = await wallet.deployContract({ abi: item.abi, bytecode, args: parameters });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${name} deploy failed: ${hash}`);
  const result = { address: receipt.contractAddress, transactionHash: hash, blockNumber: receipt.blockNumber.toString() };
  checkpoint.contracts[checkpointKey] = result;
  saveCheckpoint();
  console.log(`${name} deployed: ${result.address} (${hash}) block ${result.blockNumber}`);
  return result;
}

async function call(address, abi, functionName, parameters = []) {
  const saved = checkpoint.transactions[functionName];
  if (saved) {
    const receipt = await pub.getTransactionReceipt({ hash: saved });
    if (receipt.status === "success") {
      console.log(`${functionName} already confirmed: ${saved}`);
      return saved;
    }
    throw new Error(`Saved ${functionName} did not succeed; inspect ${checkpointPath}.`);
  }
  const hash = await wallet.writeContract({ address, abi, functionName, args: parameters });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} failed: ${hash}`);
  checkpoint.transactions[functionName] = hash;
  saveCheckpoint();
  console.log(`${functionName} confirmed: ${hash}`);
  return hash;
}

const balance = await pub.getBalance({ address: account.address });
console.log(`Deployer ${account.address} balance: ${formatEther(balance)} ETH`);
if (balance === 0n) throw new Error("Fund testnet wallet first.");

const withdrawalVerifier = await deploy("WithdrawalVerifier");
const commitmentVerifier = await deploy("CommitmentVerifier");
const entrypointImplementation = await deploy("Entrypoint", [], "entrypointImplementation");
const entrypointArtifact = artifact("Entrypoint");
const initializeData = encodeFunctionData({
  abi: entrypointArtifact.abi,
  functionName: "initialize",
  args: [account.address, postman],
});
const proxy = await deploy("ERC1967Proxy", [entrypointImplementation.address, initializeData], "entrypointProxy");
const pool = await deploy(
  "VeilTestnetPrivacyPool",
  [proxy.address, withdrawalVerifier.address, commitmentVerifier.address, guardian],
  "pool"
);

const rootTx = await call(proxy.address, entrypointArtifact.abi, "updateRoot", [aspRoot, aspCid]);
const nativeAsset = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const registerTx = await call(proxy.address, entrypointArtifact.abi, "registerPool", [nativeAsset, pool.address, denomination, 0n, 0n]);
const ownerRole = keccak256(new TextEncoder().encode("OWNER_ROLE"));
const renounceTx = await call(proxy.address, entrypointArtifact.abi, "renounceRole", [ownerRole, account.address]);
const poolArtifact = artifact("VeilTestnetPrivacyPool");
const activateTx = await call(pool.address, poolArtifact.abi, "activateDeposits", []);

const manifest = {
  schemaVersion: 1,
  status: "testnet",
  chainId: 46630,
  protocol: "0xbow-privacy-pools-core-v1.2.1",
  sourceCommit: "a80836a47451e662f127af17e11430ffa976c234",
  compiler: "solc 0.8.28",
  denominationWei: denomination.toString(),
  lifetimeDepositCapWei: parseEther("10").toString(),
  protocolFeeBps: 0,
  relayFeeBps: 0,
  deployer: account.address,
  aspPostman: postman,
  guardian,
  associationSet: { root: aspRoot.toString(), cid: aspCid, origin: aspOrigin },
  contracts: {
    withdrawalVerifier,
    commitmentVerifier,
    entrypointImplementation,
    entrypointProxy: proxy,
    pool,
    libraries: checkpoint.contracts.libraries,
  },
  transactions: { rootTx, registerTx, renounceOwnerRoleTx: renounceTx, activateDepositsTx: activateTx },
  poolDeploymentBlock: pool.blockNumber,
  entrypointDeploymentBlock: proxy.blockNumber,
  publishedAt: new Date().toISOString(),
  privacyClaim: "Testnet only. No production privacy or compliance claim.",
};
mkdirSync(join(root, "deployments"), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
try {
  const { rmSync } = await import("node:fs");
  rmSync(checkpointPath, { force: true });
} catch {}
console.log(`Wrote deployment manifest: ${manifestPath}`);

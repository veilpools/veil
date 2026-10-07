// scripts/privacy-pools-testnet-e2e.mjs
// REAL Groth16 end-to-end on Robinhood TESTNET 46630 ONLY.
// Deposit 0.001 ETH via SDK commitment, prove withdraw with wasm+zkey, relay to fresh address.
// Routes ALL rpc through scripts/rpc-helper.mjs. Never mainnet. Never prints keys.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  encodeAbiParameters,
  formatEther,
  parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey, generateMnemonic, mnemonicToAccount, english } from "viem/accounts";
import {
  AccountService,
  PrivacyPoolSDK,
  DataService,
  calculateContext,
  generateMerkleProof,
  getCommitment,
} from "@0xbow/privacy-pools-core-sdk";
import { rpcRequest } from "./rpc-helper.mjs";

const root = process.cwd();
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
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set PRIVATE_KEY in .env.local (testnet only).");
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

if (Number(await pub.getChainId()) !== 46630) throw new Error("RPC chain mismatch; aborting (testnet 46630 only).");

const manifest = JSON.parse(readFileSync(join(root, "deployments", "privacy-pools-testnet-latest.json"), "utf8"));
if (manifest.chainId !== 46630) throw new Error("Manifest is not testnet 46630; refusing.");
const poolAddress = manifest.contracts.pool.address;
const entrypoint = manifest.contracts.entrypointProxy.address;
const denomination = BigInt(manifest.denominationWei);
if (denomination !== parseEther("0.001")) throw new Error("Unexpected denomination.");

const poolArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "VeilTestnetPrivacyPool.json"), "utf8"));
const entrypointArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "Entrypoint.json"), "utf8"));

const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const SENTINEL = SNARK_FIELD - 1n;

class FileCircuits {
  async getWasm(name) {
    return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.wasm`)));
  }
  async getProvingKey(name) {
    return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.zkey`)));
  }
  async getVerificationKey(name) {
    return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.vkey`)));
  }
}

class E2EDataService extends DataService {
  constructor(configs, client) {
    super(configs, new Map(configs.map((c) => [c.chainId, { blockChunkSize: 1800, concurrency: 1, chunkDelayMs: 100, retryOnFailure: true, maxRetries: 5, retryBaseDelayMs: 1000 }])));
    this.client = client;
  }
  async logs(pool, eventName) {
    const end = await this.client.getBlockNumber();
    const out = [];
    const CHUNK = 40000n;
    for (let from = pool.deploymentBlock; from <= end; from += CHUNK) {
      const to = from + CHUNK - 1n < end ? from + CHUNK - 1n : end;
      out.push(...await this.client.getContractEvents({ address: pool.address, abi: poolArtifact.abi, eventName, fromBlock: from, toBlock: to, strict: true }));
    }
    return out;
  }
  async getDeposits(pool) {
    const logs = await this.logs(pool, "Deposited");
    return logs.map((l) => ({ depositor: l.args._depositor.toLowerCase(), commitment: l.args._commitment, label: l.args._label, value: l.args._value, precommitment: l.args._precommitmentHash, blockNumber: l.blockNumber, transactionHash: l.transactionHash }));
  }
  async getWithdrawals(pool, fromBlock = pool.deploymentBlock) {
    const logs = await this.logs(pool, "Withdrawn");
    return logs.filter((l) => l.blockNumber >= fromBlock).map((l) => ({ withdrawn: l.args._value, spentNullifier: l.args._spentNullifier, newCommitment: l.args._newCommitment, blockNumber: l.blockNumber, transactionHash: l.transactionHash }));
  }
  async getRagequits() { return []; }
}

function buildStateTree(depositCommitments, withdrawalNewCommitments) {
  const leaves = [...depositCommitments, ...withdrawalNewCommitments];
  if (!leaves.length) throw new Error("empty state tree");
  const root = BigInt(generateMerkleProof(leaves, leaves[0]).root);
  return { leaves, root, proof: (c) => { const p = generateMerkleProof(leaves, c); if (BigInt(p.root) !== root) throw new Error("state root mismatch"); return p; } };
}

const balanceBefore = await pub.getBalance({ address: account.address });
console.log(`Operator ${account.address} balance: ${formatEther(balanceBefore)} ETH`);
const paused = await pub.readContract({ address: poolAddress, abi: poolArtifact.abi, functionName: "depositsPaused" });
if (paused) throw new Error("Pool deposits paused; aborting.");
if (balanceBefore < denomination) throw new Error(`Insufficient testnet balance to front 0.001 ETH deposit (have ${formatEther(balanceBefore)}). Fund wallet or reuse note; aborting without spending gas.`);

const scope = await pub.readContract({ address: poolAddress, abi: poolArtifact.abi, functionName: "SCOPE" });
const poolInfo = { chainId: 46630, address: poolAddress, scope, deploymentBlock: BigInt(manifest.poolDeploymentBlock) };
const phrase = generateMnemonic(english, 256);
// The SDK fetches through the config rpcUrl with plain fetch, which cannot
// reach Robinhood RPC from here. Serve a loopback forwarder that relays via
// the IP-bypass helper and point the SDK at it.
const LOCAL_RPC_URL = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const out = await rpcRequest(46630, body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(typeof out === "string" ? out : JSON.stringify(out));
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: e.message } }));
      }
    });
  });
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
});
const dataService = new E2EDataService([{ chainId: 46630, privacyPoolAddress: poolAddress, startBlock: poolInfo.deploymentBlock, rpcUrl: LOCAL_RPC_URL }], pub);
const sdk = new PrivacyPoolSDK(new FileCircuits());
const accountService = new AccountService(dataService, { mnemonic: phrase.trim() });
const secrets = accountService.createDepositSecrets(poolInfo.scope);
console.log(`Depositing 0.001 ETH with SDK precommitment...`);

const depositHash = await wallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "deposit", args: [secrets.precommitment], value: denomination });
console.log(`Deposit tx: ${depositHash}`);
const depositReceipt = await pub.waitForTransactionReceipt({ hash: depositHash });
if (depositReceipt.status !== "success") throw new Error(`Deposit failed: ${depositHash}`);
console.log(`Deposit confirmed block ${depositReceipt.blockNumber}`);

const restored = { account: accountService };
// Register our just-made deposit locally instead of history scanning:
// read our own event, verify the commitment recomputes, then addPoolAccount.
const ownLogs = await pub.getContractEvents({
  address: poolAddress, abi: poolArtifact.abi, eventName: "Deposited",
  fromBlock: depositReceipt.blockNumber, toBlock: depositReceipt.blockNumber,
});
const ours = ownLogs.find((e) => e.transactionHash === depositHash);
if (!ours) throw new Error("Own deposit event not found in receipt block.");
const ourLabel = BigInt(ours.args._label);
const expected = getCommitment(denomination, ourLabel, secrets.nullifier, secrets.secret);
const expectedHash = BigInt(expected.hash ?? expected);
if (expectedHash !== BigInt(ours.args._commitment)) {
  throw new Error("Commitment derivation mismatch between SDK and onchain event.");
}
console.log("Commitment derivation matches onchain event.");
accountService.addPoolAccount(
  poolInfo.scope, denomination, secrets.nullifier, secrets.secret,
  ourLabel, depositReceipt.blockNumber, depositHash
);
const notes = accountService.getSpendableCommitments().get(poolInfo.scope) ?? [];
if (!notes.length) throw new Error("No spendable note after local registration.");
const commitment = notes[0];
console.log("Note registered locally for scope.");

// Publish ASP set including our label + sentinel, update onchain root
const allDeposits = await dataService.getDeposits(poolInfo);
console.log(`DEBUG getDeposits returned ${allDeposits.length} rows; ours=${ourLabel}`);
console.log(`DEBUG hasOurs=${allDeposits.some((d) => BigInt(d.label) === ourLabel)}`);
const labels = [...new Set(allDeposits.map((d) => d.label.toString()))].map(BigInt).sort((a, b) => (a < b ? -1 : 1));
const withSentinel = [...labels, ...(labels.map(String).includes(SENTINEL.toString()) ? [] : [SENTINEL])].sort((a, b) => (a < b ? -1 : 1));
const aspProof0 = generateMerkleProof(withSentinel, withSentinel[0]);
const aspRoot = BigInt(aspProof0.root);
const aspCid = `local-e2e-asp-46630-${depositReceipt.blockNumber}-0xbow-v1.2.1`;
const updateHash = await wallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "updateRoot", args: [aspRoot, aspCid] });
await pub.waitForTransactionReceipt({ hash: updateHash });
console.log(`ASP root updated: ${updateHash} root=${aspRoot}`);

// Rebuild state tree from events
const deposits = await pub.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Deposited", fromBlock: poolInfo.deploymentBlock, toBlock: "latest" });
const withdrawals = await pub.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Withdrawn", fromBlock: poolInfo.deploymentBlock, toBlock: "latest" });
const ordered = [
  ...deposits.map((e) => ({ c: BigInt(e.args._commitment), b: e.blockNumber, i: e.logIndex })),
  ...withdrawals.map((e) => ({ c: BigInt(e.args._newCommitment), b: e.blockNumber, i: e.logIndex })),
].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
const tree = buildStateTree(ordered, []);
console.log(`DEBUG leaves=${tree.leaves.length} hashoff=${typeof commitment.hash} includes=${tree.leaves.includes(commitment.hash)} sqeq=${tree.leaves.some((l) => l === commitment.hash)} root=${String(tree.root).slice(0, 20)} chash=${String(commitment.hash).slice(0, 20)}`);
if (!tree.leaves.includes(commitment.hash)) throw new Error("Recovered commitment missing from rebuilt state.");
const stateProof = tree.proof(commitment.hash);
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");
const aspProof = genProof(withSentinel, commitment.label);
if (BigInt(aspProof.root) !== aspRoot) throw new Error("ASP proof root mismatch.");
const secretPair = restored.account.createWithdrawalSecrets(commitment);
const fresh = privateKeyToAccount(generatePrivateKey()).address;
const data = encodeAbiParameters([{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }], [{ recipient: fresh, feeRecipient: account.address, relayFeeBPS: 0n }]);
const withdrawal = { processooor: entrypoint, data };
const context = BigInt(calculateContext(withdrawal, poolInfo.scope));
console.log(`Generating REAL Groth16 withdraw proof (wasm+zkey)...`);
const withdrawalProof = await sdk.proveWithdrawal(commitment, {
  withdrawalAmount: denomination,
  stateMerkleProof: stateProof,
  aspMerkleProof: aspProof,
  stateRoot: tree.root,
  stateTreeDepth: 32n,
  aspRoot,
  aspTreeDepth: 32n,
  context,
  newNullifier: secretPair.nullifier,
  newSecret: secretPair.secret,
});
if (!(await sdk.verifyWithdrawal(withdrawalProof))) throw new Error("SDK withdrawal proof failed local verify.");
console.log(`Groth16 proof verified locally; relaying...`);
const pc = withdrawalProof.proof;
const proofStruct = {
  pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])],
  pB: [[BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])], [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])]],
  pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])],
  pubSignals: withdrawalProof.publicSignals.map(BigInt),
};
const relayHash = await wallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "relay", args: [withdrawal, proofStruct, poolInfo.scope] });
const relayReceipt = await pub.waitForTransactionReceipt({ hash: relayHash });
if (relayReceipt.status !== "success") throw new Error(`Relay failed: ${relayHash}`);
console.log(`Relay confirmed block ${relayReceipt.blockNumber}: ${relayHash}`);

const nullifier = BigInt(withdrawalProof.publicSignals[1]);
const spent = await pub.readContract({ address: poolAddress, abi: poolArtifact.abi, functionName: "nullifierHashes", args: [nullifier] });
if (!spent) throw new Error("Nullifier not marked spent.");
const freshBal = await pub.getBalance({ address: fresh });
if (freshBal !== denomination) throw new Error(`Fresh balance mismatch: ${formatEther(freshBal)}`);
console.log(`SUCCESS real Groth16 e2e: deposit=${depositHash} aspUpdate=${updateHash} relay=${relayHash} fresh=${fresh} balance=${formatEther(freshBal)} nullifierSpent=${spent}`);
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${depositHash}`);
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${relayHash}`);

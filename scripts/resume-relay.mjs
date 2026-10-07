// TESTNET ONLY (46630). Resumes a backed-up note (no new deposit) and relays
// the withdrawal. Usage: node scripts/resume-relay.mjs --sender relayer|user
// Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  AccountService, PrivacyPoolSDK, calculateContext, generateMerkleProof,
} from "@0xbow/privacy-pools-core-sdk";
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

const senderArg = process.argv[process.argv.indexOf("--sender") + 1] ?? "";
const asRelayer = senderArg !== "user";
const note = JSON.parse(readFileSync(".superpowers/sdd/round2/.last-note.json", "utf8"));
if (!note.label || !note.nullifier || !note.secret) throw new Error("Backup lacks deposit details; re-run relay-testnet first.");
const poolAddress = note.poolAddress;
const scope = BigInt(note.scope);
const denomination = BigInt(note.denomination);
const ourLabel = BigInt(note.label);

const key = (process.env.PRIVATE_KEY ?? "").trim();
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const chain = { id: 46630, name: "Robinhood Chain Testnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:1"] } } };
const publicClient = createPublicClient({ chain, transport });
const account = privateKeyToAccount(key);
const wallet = createWalletClient({ account, chain, transport });

const manifest = JSON.parse(readFileSync(join(root, "deployments", "privacy-pools-testnet-latest.json"), "utf8"));
const entrypoint = manifest.contracts.entrypointProxy.address;
const poolArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "VeilTestnetPrivacyPool.json"), "utf8"));
const entrypointArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "Entrypoint.json"), "utf8"));

class FileCircuits {
  async getWasm(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.wasm`))); }
  async getProvingKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.zkey`))); }
  async getVerificationKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());
const accountService = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: note.phrase.trim() });
accountService.addPoolAccount(scope, denomination, BigInt(note.nullifier), BigInt(note.secret), ourLabel, BigInt(note.depositBlock), note.depositTx);
const commitment = accountService.getSpendableCommitments().get(scope)[0];
console.log("note re-registered, no new deposit spent");

let senderWallet = wallet;
let senderName = "user";
if (asRelayer) {
  const relayer = privateKeyToAccount(generatePrivateKey());
  senderWallet = createWalletClient({ account: relayer, chain, transport });
  const fh = await wallet.sendTransaction({ to: relayer.address, value: parseEther("0.0002") });
  await publicClient.waitForTransactionReceipt({ hash: fh });
  senderName = `relayer ${relayer.address}`;
}

const deposits = await publicClient.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Deposited", fromBlock: BigInt(manifest.poolDeploymentBlock), toBlock: "latest" });
const withdrawals = await publicClient.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Withdrawn", fromBlock: BigInt(manifest.poolDeploymentBlock), toBlock: "latest" });
const leaves = [
  ...deposits.map((e) => ({ c: BigInt(e.args._commitment), b: e.blockNumber, i: e.logIndex })),
  ...withdrawals.map((e) => ({ c: BigInt(e.args._newCommitment), b: e.blockNumber, i: e.logIndex })),
].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");
const tree = { leaves, root: BigInt(genProof(leaves, leaves[0]).root), proof: (c) => genProof(leaves, c) };
const labels = [...new Set(deposits.map((d) => BigInt(d.args._label)))].sort((a, b) => (a < b ? -1 : 1));
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
if (!labels.map(String).includes((SNARK_FIELD - 1n).toString())) labels.push(SNARK_FIELD - 1n);
labels.sort((a, b) => (a < b ? -1 : 1));
const stateProof = tree.proof(commitment.hash);
const aspProof = genProof(labels, commitment.label);
const secretPair = accountService.createWithdrawalSecrets(commitment);
const fresh = privateKeyToAccount(generatePrivateKey()).address;
const data = encodeAbiParameters(
  [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
  [{ recipient: fresh, feeRecipient: senderWallet.account.address, relayFeeBPS: 0n }]
);
const withdrawal = { processooor: entrypoint, data };
const context = BigInt(calculateContext(withdrawal, poolInfoScope()));
function poolInfoScope() { return scope; }
console.log(`proving for ${senderName}...`);
const proof = await sdk.proveWithdrawal(commitment, {
  withdrawalAmount: denomination, stateMerkleProof: stateProof, aspMerkleProof: aspProof,
  stateRoot: tree.root, stateTreeDepth: 32n, aspRoot: BigInt(genProof(labels, labels[0]).root), aspTreeDepth: 32n,
  context, newNullifier: secretPair.nullifier, newSecret: secretPair.secret,
});
if (!(await sdk.verifyWithdrawal(proof))) throw new Error("local verify failed");
const pc = proof.proof;
const proofStruct = {
  pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])],
  pB: [[BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])], [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])]],
  pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])],
  pubSignals: proof.publicSignals.map(BigInt),
};
const onchainRoots = await publicClient.readContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "latestRoot" }).catch(() => null);
console.log(`DEBUG stateRoot=${tree.root} onchainLatestRoot=${onchainRoots} proofAspRoot=${BigInt(genProof(labels, labels[0]).root)}`);
import { encodeFunctionData as encRelay } from "viem";
const relayCalldata = encRelay({ abi: entrypointArtifact.abi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
console.log(`CALLDATA ${senderWallet.account.address} ${relayCalldata}`);
try {
  const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: senderWallet.account.address, to: entrypoint, data: relayCalldata }, "latest"] }),
  }).then((r) => r.json());
  console.log("PUBLICNODE SIM:", JSON.stringify(sim).slice(0, 300));
} catch (e) { console.log("publicnode sim failed:", e.message); }
const relayHash = await senderWallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
const rc = await publicClient.waitForTransactionReceipt({ hash: relayHash });
console.log(`relay via ${senderName}: ${relayHash} status=${rc.status} fresh=${fresh}`);
if (rc.status !== "success") throw new Error("relay reverted");

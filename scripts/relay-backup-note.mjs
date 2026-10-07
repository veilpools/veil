// TESTNET ONLY (46630). Relays the backed-up swap note (no new deposit).
// Usage: node scripts/relay-backup-note.mjs. Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  AccountService, PrivacyPoolSDK, calculateContext, generateMerkleProof, getCommitment,
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

const S = JSON.parse(readFileSync(join(root, "deployments", "suite-v3-testnet-latest.json"), "utf8"));
const note = JSON.parse(readFileSync(".superpowers/sdd/round2/.swap-note.json", "utf8"));
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
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain, transport });
const art = (n) => JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", `${n}.json`), "utf8"));
const epAbi = art("Entrypoint").abi;
const poolAbi = art("VeilTestnetPrivacyPool").abi;

class FileCircuits {
  async getWasm(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.wasm`))); }
  async getProvingKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.zkey`))); }
  async getVerificationKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");

const scope = await publicClient.readContract({ address: S.ethPool, abi: poolAbi, functionName: "SCOPE" });
const denom = parseEther("0.001");
const svc = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: note.phrase.trim() });
const secrets = svc.createDepositSecrets(scope);
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const head = await publicClient.getBlockNumber();
const deposits = await publicClient.getContractEvents({ address: S.ethPool, abi: poolAbi, eventName: "Deposited", fromBlock: head - 60000n, toBlock: "latest" });
let ours = null;
for (const e of deposits) {
  const c = getCommitment(denom, BigInt(e.args._label), secrets.nullifier, secrets.secret);
  const ch = BigInt(c.hash ?? c);
  if (ch === BigInt(e.args._commitment)) { ours = e; break; }
}
if (!ours) throw new Error("Backed-up note not found onchain (wrong phrase or pruned range).");
console.log("found our deposit:", ours.transactionHash);
const ourLabel = BigInt(ours.args._label);
svc.addPoolAccount(scope, denom, secrets.nullifier, secrets.secret, ourLabel, ours.blockNumber, ours.transactionHash);
const commitment = svc.getSpendableCommitments().get(scope)[0];

const withdrawals = await publicClient.getContractEvents({ address: S.ethPool, abi: poolAbi, eventName: "Withdrawn", fromBlock: head - 60000n, toBlock: "latest" });
const leaves = [
  ...deposits.map((e) => ({ c: BigInt(e.args._commitment), b: e.blockNumber, i: e.logIndex })),
  ...withdrawals.map((e) => ({ c: BigInt(e.args._newCommitment), b: e.blockNumber, i: e.logIndex })),
].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
const tree = { leaves, root: BigInt(genProof(leaves, leaves[0]).root), proof: (c) => genProof(leaves, c) };
const labels = [...new Set(deposits.map((d) => BigInt(d.args._label)))].sort((a, b) => (a < b ? -1 : 1));
if (!labels.map(String).includes((SNARK_FIELD - 1n).toString())) labels.push(SNARK_FIELD - 1n);
labels.sort((a, b) => (a < b ? -1 : 1));
const aspRoot = BigInt(genProof(labels, labels[0]).root);
const onchainAsp = await publicClient.readContract({ address: S.entrypoint, abi: epAbi, functionName: "latestRoot" });
console.log("asp recomputed matches onchain:", aspRoot === onchainAsp);
if (aspRoot !== onchainAsp) {
  const uh = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v3-asp-46630-resume-000000"] });
  await publicClient.waitForTransactionReceipt({ hash: uh });
  console.log("ASP root refreshed:", uh);
}
const stateProof = tree.proof(commitment.hash);
const aspProof = genProof(labels, commitment.label);
const secretPair = svc.createWithdrawalSecrets(commitment);
const fresh = privateKeyToAccount(generatePrivateKey()).address;
const data = encodeAbiParameters(
  [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
  [{ recipient: fresh, feeRecipient: account.address, relayFeeBPS: 0n }]
);
const withdrawal = { processooor: S.entrypoint, data };
const context = BigInt(calculateContext(withdrawal, scope));
console.log("proving...");
const proof = await sdk.proveWithdrawal(commitment, {
  withdrawalAmount: denom, stateMerkleProof: stateProof, aspMerkleProof: aspProof,
  stateRoot: tree.root, stateTreeDepth: 32n, aspRoot, aspTreeDepth: 32n,
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
const h = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("relay:", h, rc.status, "fresh:", fresh);
if (rc.status !== "success") throw new Error("relay reverted");
console.log("SUCCESS backup-note relay, no new deposit spent");

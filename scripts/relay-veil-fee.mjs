// TESTNET ONLY (46630). Relays the backed-up VEIL note via a fresh relayer
// key with enforced 50 BPS fee on suite v3. Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, formatEther, parseEther,
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

const S = JSON.parse(readFileSync(join(root, "deployments", "suite-v3-testnet-latest.json"), "utf8"));
const note = JSON.parse(readFileSync(".superpowers/sdd/round2/.swap-veil-note.json", "utf8"));
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
const poolAbi = art("VeilTestnetPrivacyPoolERC20").abi;

class FileCircuits {
  async getWasm(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.wasm`))); }
  async getProvingKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.zkey`))); }
  async getVerificationKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");

const scope = BigInt(note.scope);
const value = BigInt(note.value);
const svc = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: note.phrase.trim() });
const depBlock = BigInt(note.depositBlock);
const ownEv = await publicClient.getContractEvents({ address: S.veilPool, abi: poolAbi, eventName: "Deposited", fromBlock: depBlock, toBlock: depBlock });
const oursEv = ownEv.find((e) => e.transactionHash === note.depositTx);
if (!oursEv) throw new Error("own VEIL deposit event not found");
const ourLabel = BigInt(oursEv.args._label);
svc.addPoolAccount(scope, value, BigInt(note.nullifier), BigInt(note.secret), ourLabel, depBlock, note.depositTx);
const commitment = svc.getSpendableCommitments().get(scope)[0];

const relayer = privateKeyToAccount(generatePrivateKey());
const relayerWallet = createWalletClient({ account: relayer, chain, transport });
let h = await wallet.sendTransaction({ to: relayer.address, value: parseEther("0.0003") });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("relayer funded:", relayer.address);

const head = await publicClient.getBlockNumber();
const deposits = await publicClient.getContractEvents({ address: S.veilPool, abi: poolAbi, eventName: "Deposited", fromBlock: head - 50000n, toBlock: "latest" });
const withdrawals = await publicClient.getContractEvents({ address: S.veilPool, abi: poolAbi, eventName: "Withdrawn", fromBlock: head - 50000n, toBlock: "latest" });
const leaves = [
  ...deposits.map((e) => ({ c: BigInt(e.args._commitment), b: e.blockNumber, i: e.logIndex })),
  ...withdrawals.map((e) => ({ c: BigInt(e.args._newCommitment), b: e.blockNumber, i: e.logIndex })),
].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
const tree = { leaves, root: BigInt(genProof(leaves, leaves[0]).root), proof: (c) => genProof(leaves, c) };
if (!tree.leaves.includes(commitment.hash)) throw new Error("note missing from VEIL state");
const FEE_BPS = 50n;
const fresh = privateKeyToAccount(generatePrivateKey()).address;
const data = encodeAbiParameters(
  [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
  [{ recipient: fresh, feeRecipient: relayer.address, relayFeeBPS: FEE_BPS }]
);
const withdrawal = { processooor: S.entrypoint, data };
const context = BigInt(calculateContext(withdrawal, scope));
// ASP: pool-specific labels + sentinel; refresh onchain root first.
const labels = [...new Set(deposits.map((d) => BigInt(d.args._label)))].sort((a, b) => (a < b ? -1 : 1));
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
if (!labels.map(String).includes((SNARK_FIELD - 1n).toString())) labels.push(SNARK_FIELD - 1n);
labels.sort((a, b) => (a < b ? -1 : 1));
const aspRoot = BigInt(genProof(labels, labels[0]).root);
h = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v3-asp-46630-veil-relay-00"] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("ASP refreshed for VEIL relay");
const aspProof = genProof(labels, commitment.label);
const stateProof = tree.proof(commitment.hash);
const secretPair = svc.createWithdrawalSecrets(commitment);
console.log("proving VEIL withdraw (fee-bound)...");
const proof = await sdk.proveWithdrawal(commitment, {
  withdrawalAmount: value, stateMerkleProof: stateProof, aspMerkleProof: aspProof,
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
const expectedFee = (value * FEE_BPS) / 10000n;
const relayHash = await relayerWallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
const rc = await publicClient.waitForTransactionReceipt({ hash: relayHash });
console.log("VEIL relay:", relayHash, rc.status);
if (rc.status !== "success") throw new Error("VEIL relay reverted");
const veilAbi = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "o", type: "address" }], outputs: [{ name: "", type: "uint256" }] }];
const freshBal = await publicClient.readContract({ address: S.veilToken, abi: veilAbi, functionName: "balanceOf", args: [fresh] });
const relBal = await publicClient.readContract({ address: S.veilToken, abi: veilAbi, functionName: "balanceOf", args: [relayer.address] });
console.log("fresh VEIL:", freshBal.toString(), "relayer VEIL fee:", relBal.toString(), "expected fee:", expectedFee.toString());
if (freshBal !== value - expectedFee) throw new Error("recipient payout mismatch");
if (relBal !== expectedFee) throw new Error("relayer fee mismatch");
console.log("SUCCESS VEIL relay with enforced 50 BPS fee by third-party key");
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${relayHash}`);

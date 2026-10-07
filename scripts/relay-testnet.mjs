// TESTNET ONLY (46630). Proves third-party relay with enforced fee:
// fresh relayer key submits entrypoint.relay, collects relayFeeBPS.
// Never mainnet. Burns ~0.0013 testnet ETH total.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, formatEther, parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey, generateMnemonic, english } from "viem/accounts";
import {
  AccountService, PrivacyPoolSDK, DataService, calculateContext, generateMerkleProof, getCommitment,
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
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const key = (process.env.PRIVATE_KEY ?? "").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set PRIVATE_KEY in env (testnet only).");

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
const poolAddress = manifest.contracts.pool.address;
const entrypoint = manifest.contracts.entrypointProxy.address;
const denomination = BigInt(manifest.denominationWei);
const poolArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "VeilTestnetPrivacyPool.json"), "utf8"));
const entrypointArtifact = JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", "Entrypoint.json"), "utf8"));

class FileCircuits {
  async getWasm(name) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.wasm`))); }
  async getProvingKey(name) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.zkey`))); }
  async getVerificationKey(name) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${name}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());

// Ephemeral relayer: fund with dust, submit relay, keep fee.
const relayerKey = generatePrivateKey();
const relayer = privateKeyToAccount(relayerKey);
const relayerWallet = createWalletClient({ account: relayer, chain, transport });
let h = await wallet.sendTransaction({ to: relayer.address, value: parseEther("0.0003") });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("relayer funded:", relayer.address);

const poolInfo = { chainId: 46630, address: poolAddress, scope: await publicClient.readContract({ address: poolAddress, abi: poolArtifact.abi, functionName: "SCOPE" }), deploymentBlock: BigInt(manifest.poolDeploymentBlock) };
const phrase = generateMnemonic(english, 256);
const accountService = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: phrase.trim() });
const secrets = accountService.createDepositSecrets(poolInfo.scope);
h = await wallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "deposit", args: [secrets.precommitment], value: denomination });
const depRc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("deposit:", h);
const FEE_BPS = 50n;
const fresh = privateKeyToAccount(generatePrivateKey()).address;

const ownLogs = await publicClient.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Deposited", fromBlock: depRc.blockNumber, toBlock: depRc.blockNumber });
const ours = ownLogs.find((e) => e.transactionHash === h);
const ourLabel = BigInt(ours.args._label);
accountService.addPoolAccount(poolInfo.scope, denomination, secrets.nullifier, secrets.secret, ourLabel, depRc.blockNumber, h);
const commitment = accountService.getSpendableCommitments().get(poolInfo.scope)[0];

const deposits = await publicClient.getContractEvents({ address: poolAddress, abi: poolArtifact.abi, eventName: "Deposited", fromBlock: poolInfo.deploymentBlock, toBlock: "latest" });
const leaves = deposits.map((e) => BigInt(e.args._commitment));
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");
const tree = { leaves, root: BigInt(genProof(leaves, leaves[0]).root), proof: (c) => genProof(leaves, c) };
const labels = [...new Set(deposits.map((d) => BigInt(d.args._label)))].sort((a, b) => (a < b ? -1 : 1));
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
if (!labels.map(String).includes((SNARK_FIELD - 1n).toString())) labels.push(SNARK_FIELD - 1n);
labels.sort((a, b) => (a < b ? -1 : 1));
const aspRoot = BigInt(genProof(labels, labels[0]).root);
const cid = `local-relay-asp-46630-${depRc.blockNumber}-0xbow-v1.2.1`;
h = await wallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "updateRoot", args: [aspRoot, cid] });
await publicClient.waitForTransactionReceipt({ hash: h });

const stateProof = tree.proof(commitment.hash);
const aspProof = genProof(labels, commitment.label);
const secretPair = accountService.createWithdrawalSecrets(commitment);
const data = encodeAbiParameters(
  [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
  [{ recipient: fresh, feeRecipient: relayer.address, relayFeeBPS: FEE_BPS }]
);
const withdrawal = { processooor: entrypoint, data };
const context = BigInt(calculateContext(withdrawal, poolInfo.scope));
console.log("proving (relayer fee bound)...");
const proof = await sdk.proveWithdrawal(commitment, {
  withdrawalAmount: denomination, stateMerkleProof: stateProof, aspMerkleProof: aspProof,
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
const freshBefore = await publicClient.getBalance({ address: fresh });
const relayBefore = await publicClient.getBalance({ address: relayer.address });
const relayHash = await relayerWallet.writeContract({ address: entrypoint, abi: entrypointArtifact.abi, functionName: "relay", args: [withdrawal, proofStruct, poolInfo.scope] });
const relayRc = await publicClient.waitForTransactionReceipt({ hash: relayHash });
if (relayRc.status !== "success") throw new Error("relay reverted");
const expectedFee = (denomination * FEE_BPS) / 10000n;
const freshAfter = await publicClient.getBalance({ address: fresh });
const relayAfter = await publicClient.getBalance({ address: relayer.address });
console.log("relay:", relayHash, "fresh +:", (freshAfter - freshBefore).toString(), "relayer net (fee-gas):", (relayAfter - relayBefore).toString(), "expected fee:", expectedFee.toString());
if (freshAfter - freshBefore !== denomination - expectedFee) throw new Error("recipient payout mismatch");
if (relayAfter <= relayBefore) throw new Error("relayer earned nothing");
console.log("SUCCESS third-party relay with enforced fee");
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${relayHash}`);

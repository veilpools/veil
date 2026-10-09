import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther, encodeAbiParameters } from "../node_modules/viem/_esm/index.js";
import { privateKeyToAccount, generateMnemonic, english } from "../node_modules/viem/_esm/accounts/index.js";
import { AccountService, PrivacyPoolSDK, calculateContext, generateMerkleProof, generateDepositSecrets, generateMasterKeys, hashPrecommitment } from "../node_modules/@0xbow/privacy-pools-core-sdk/dist/node/index.mjs";
import { robinhoodTestnet } from "file:///D:/Project/wealthypeople/veil/lib/chains.mjs";
import { rpcRequest } from "file:///D:/Project/wealthypeople/veil/scripts/rpc-helper.mjs";
const root = "D:/Project/wealthypeople/veil";
function loadEnvFile(path) {
  try {
    for (const rawLine of readFileSync(join(root, path), "utf8").split("\n")) {
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
const ZKR = JSON.parse(readFileSync(join(root, "deployments", "zkrouter-multi-46630.json"), "utf8"));
const notes = JSON.parse(readFileSync(join(root, "deployments", "tmp-multi-notes.json"), "utf8"));
const key = (process.env.PRIVATE_KEY ?? "").trim();
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const pub = createPublicClient({ chain: robinhoodTestnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport });
if (Number(await pub.getChainId()) !== 46630) throw new Error("not testnet");
const art = (n) => JSON.parse(readFileSync(join(root, "artifacts", "privacy-pools-testnet", `${n}.json`), "utf8"));
const { VEIL_ZK_ROUTER_ABI } = await import("file:///D:/Project/wealthypeople/veil/lib/veil-artifact.mjs");
const ZERO = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const poolAbi = art("VeilTestnetPrivacyPool").abi;
const epAbi = art("Entrypoint").abi;
const FROM = 131500000n;
async function allEvents(name) {
  const cur = await pub.getBlockNumber();
  const out = [];
  for (let f = FROM; f < cur; f += 9000000n) {
    const t = f + 9000000n > cur ? cur : f + 9000000n;
    out.push(...await pub.getContractEvents({ address: S.ethPool, abi: poolAbi, eventName: name, fromBlock: f, toBlock: t }));
  }
  return out;
}
const deposits = await allEvents("Deposited");
const wdns = await allEvents("Withdrawn").catch(() => []);
const ordered = [
  ...deposits.map((e) => ({ c: BigInt(e.args._commitment ?? e.args.commitment), b: e.blockNumber, i: e.logIndex })),
  ...wdns.map((e) => ({ c: BigInt(e.args._newCommitment ?? e.args.newCommitment), b: e.blockNumber, i: e.logIndex })),
].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
const leaves = ordered;
console.log("tree leaves:", leaves.length);
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const labels = [...new Set(deposits.map((e) => BigInt(e.args._label ?? e.args.label).toString())), (SNARK_FIELD - 1n).toString()].map(BigInt).sort((a, b) => (a < b ? -1 : 1));
const aspRoot = BigInt(generateMerkleProof(labels, labels[0]).root);
const onchain = await pub.readContract({ address: S.entrypoint, abi: epAbi, functionName: "latestRoot" });
console.log("asp mine:", aspRoot.toString().slice(0, 20), "onchain:", onchain.toString().slice(0, 20), "match:", aspRoot === onchain);
if (aspRoot !== onchain) {
  const hu = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v3-asp-46630-multifull-00"] });
  await pub.waitForTransactionReceipt({ hash: hu });
  console.log("asp republished:", hu);
}
class FileCircuits {
  async getWasm(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.wasm`))); }
  async getProvingKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.zkey`))); }
  async getVerificationKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());
const scope = BigInt(notes[0].scope);
const stateRoot = BigInt(generateMerkleProof(leaves, leaves[0]).root);
console.log("stateRoot:", stateRoot.toString().slice(0, 20));
const withdrawals = [], proofs = [], scopes = [];
for (const [i, o] of notes.map((n) => ({ note: n })).entries()) {
  const svc = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: o.note.mnemonic.trim() });
  const ev = deposits.find((d) => d.transactionHash.toLowerCase() === o.note.txHash.toLowerCase());
  const label = BigInt(ev.args._label ?? ev.args.label);
  svc.addPoolAccount(scope, parseEther("0.001"), BigInt(o.note.nullifier), BigInt(o.note.secret), label, BigInt(o.note.blockNumber), o.note.txHash);
  const commitment = svc.getSpendableCommitments().get(scope)[0];
  const stateProof = generateMerkleProof(leaves, commitment.hash);
  const aspProof = generateMerkleProof(labels, commitment.label);
  const sp = svc.createWithdrawalSecrets(commitment);
  const data = encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
    [{ recipient: ZKR.router, feeRecipient: account.address, relayFeeBPS: 0n }]
  );
  const withdrawal = { processooor: S.entrypoint, data };
  const context = BigInt(calculateContext(withdrawal, scope));
  console.log(`proving ${i} (minutes)...`);
  const proof = await sdk.proveWithdrawal(commitment, {
    withdrawalAmount: parseEther("0.001"), stateMerkleProof: stateProof, aspMerkleProof: aspProof,
    stateRoot, stateTreeDepth: 32n, aspRoot, aspTreeDepth: 32n,
    context, newNullifier: sp.nullifier, newSecret: sp.secret,
  });
  if (!(await sdk.verifyWithdrawal(proof))) throw new Error(`local verify failed ${i}`);
  const pc = proof.proof;
  withdrawals.push(withdrawal);
  proofs.push({ pA: [BigInt(pc.pi_a[0]), BigInt(pc.pi_a[1])], pB: [[BigInt(pc.pi_b[0][1]), BigInt(pc.pi_b[0][0])], [BigInt(pc.pi_b[1][1]), BigInt(pc.pi_b[1][0])]], pC: [BigInt(pc.pi_c[0]), BigInt(pc.pi_c[1])], pubSignals: proof.publicSignals.map(BigInt) });
  scopes.push(scope);
  console.log(`proof ${i} OK`);
}
writeFileSync(join(root, "deployments", "tmp-multi-proofs.json"), JSON.stringify({
  withdrawals, scopes: scopes.map(String),
  proofs: proofs.map((p) => ({ pA: p.pA.map(String), pB: p.pB.map((r) => r.map(String)), pC: p.pC.map(String), pubSignals: p.pubSignals.map(String) })),
}, null, 2));
console.log("proofs saved");
const mnemonic2 = generateMnemonic(english, 256);
const keys2 = generateMasterKeys(mnemonic2);
const pair2 = generateDepositSecrets(keys2, scope, 1n);
const newPre = `0x${hashPrecommitment(pair2.nullifier, pair2.secret).toString(16).padStart(64, "0")}`;
writeFileSync(join(root, "deployments", "tmp-multi-note2.json"), JSON.stringify({
  mnemonic: mnemonic2, nullifier: BigInt(pair2.nullifier).toString(), secret: BigInt(pair2.secret).toString(),
  precommitment: BigInt(hashPrecommitment(pair2.nullifier, pair2.secret)).toString(), scope: scope.toString(),
}, null, 2));
const swapLeg = { key: { currency0: ZERO, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ZERO }, zeroForOne: true, sqrtPriceLimitX96: 4295128740n, hookData: "0x" };
const args = [withdrawals, proofs, scopes, ZKR.router, ZERO, VEIL, parseEther("0.001"), newPre, swapLeg, parseEther("0.001")];
const sim = await pub.simulateContract({ address: ZKR.router, abi: VEIL_ZK_ROUTER_ABI, functionName: "executeMultiFullZkFlow", args, account: account.address });
console.log("sim OK, commitment:", sim.result.toString().slice(0, 20) + "...");
const hx = await wallet.writeContract({ address: ZKR.router, abi: VEIL_ZK_ROUTER_ABI, functionName: "executeMultiFullZkFlow", args });
const rcx = await pub.waitForTransactionReceipt({ hash: hx });
if (rcx.status !== "success") throw new Error("multi flow reverted: " + hx);
console.log("MULTI FULL-ZK FLOW LIVE:", hx);

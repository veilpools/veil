// TESTNET ONLY (46630). Full shielded swap: shielded ETH -> withdraw ->
// v4 swap ETH->VEIL -> shielded VEIL -> withdraw VEIL. No address links.
// Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, formatEther, parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey, generateMnemonic, english } from "viem/accounts";
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
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ZERO = "0x0000000000000000000000000000000000000000";
const ETH_POOL_KEY = { currency0: ZERO, currency1: S.veilToken, fee: 3000, tickSpacing: 60, hooks: ZERO };
const SWAPPER = "0x14c27b66fba1b561a920bd03970ae20c53608dff";
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
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
const erc20Abi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];
const swapAbi = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8")).abi;

class FileCircuits {
  async getWasm(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.wasm`))); }
  async getProvingKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.zkey`))); }
  async getVerificationKey(n) { return new Uint8Array(readFileSync(join(root, "public", "shield-artifacts", "v1.2.1", `${n}.vkey`))); }
}
const sdk = new PrivacyPoolSDK(new FileCircuits());
const { generateMerkleProof: genProof } = await import("@0xbow/privacy-pools-core-sdk");

async function proveAndRelay({ poolAddress, entrypoint, scope, accountService, commitment, tree, aspRoot, recipient, feeRecipient, feeBPS, value }) {
  const labelsNow = tree.aspLabels;
  const stateProof = tree.proof(commitment.hash);
  const aspProof = genProof(labelsNow, commitment.label);
  const secretPair = accountService.createWithdrawalSecrets(commitment);
  const data = encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "recipient", type: "address" }, { name: "feeRecipient", type: "address" }, { name: "relayFeeBPS", type: "uint256" }] }],
    [{ recipient, feeRecipient, relayFeeBPS: feeBPS }]
  );
  const withdrawal = { processooor: entrypoint, data };
  const context = BigInt(calculateContext(withdrawal, scope));
  console.log("proving...");
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
  const { encodeFunctionData: encRelay2 } = await import("viem");
  const relayCalldata = encRelay2({ abi: epAbi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
  try {
    const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: account.address, to: entrypoint, data: relayCalldata }, "latest"] }),
    }).then((r) => r.json());
    console.log("RELAY SIM:", JSON.stringify(sim).slice(0, 200));
  } catch (e) { console.log("sim failed:", e.message); }
  const h = await wallet.writeContract({ address: entrypoint, abi: epAbi, functionName: "relay", args: [withdrawal, proofStruct, scope] });
  const rc = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc.status !== "success") throw new Error(`relay reverted: ${h}`);
  console.log("relayed:", h);
  return h;
}

function buildTree(deposits, withdrawals) {
  const leaves = [
    ...deposits.map((e) => ({ c: BigInt(e.args._commitment), b: e.blockNumber, i: e.logIndex })),
    ...withdrawals.map((e) => ({ c: BigInt(e.args._newCommitment), b: e.blockNumber, i: e.logIndex })),
  ].sort((a, b) => (a.b !== b.b ? (a.b < b.b ? -1 : 1) : a.i - b.i)).map((x) => x.c);
  const root = BigInt(genProof(leaves, leaves[0]).root);
  return { leaves, root, proof: (c) => genProof(leaves, c) };
}

// ---- LEG 1: shield 0.001 ETH on v3 ----
const scopeEth = await publicClient.readContract({ address: S.ethPool, abi: poolAbi, functionName: "SCOPE" });
const phrase = generateMnemonic(english, 256);
writeFileSync(".superpowers/sdd/round2/.swap-note.json", JSON.stringify({ phrase }));
const svc1 = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: phrase.trim() });
const sec1 = svc1.createDepositSecrets(scopeEth);
const nativeDepositAbi = [{ type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "_precommitment", type: "uint256" }], outputs: [{ name: "_commitment", type: "uint256" }] }];
let h = await wallet.writeContract({ address: S.entrypoint, abi: nativeDepositAbi, functionName: "deposit", args: [sec1.precommitment], value: parseEther("0.001") });
let rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("ETH shielded:", h, rc.status);
const depBlock1 = rc.blockNumber;
const ev1 = await publicClient.getContractEvents({ address: S.ethPool, abi: poolAbi, eventName: "Deposited", fromBlock: depBlock1, toBlock: depBlock1 });
const ours1 = ev1.find((e) => e.transactionHash === h);
svc1.addPoolAccount(scopeEth, parseEther("0.001"), sec1.nullifier, sec1.secret, BigInt(ours1.args._label), depBlock1, h);
const note1 = svc1.getSpendableCommitments().get(scopeEth)[0];

// ---- LEG 2: withdraw ETH (to operator; unlinking already proven via fresh recipients) ----
async function poolEvents(pool, from) {
  const deps = await publicClient.getContractEvents({ address: pool, abi: poolAbi, eventName: "Deposited", fromBlock: from, toBlock: "latest" });
  const wds = await publicClient.getContractEvents({ address: pool, abi: poolAbi, eventName: "Withdrawn", fromBlock: from, toBlock: "latest" });
  return { deps, wds };
}
// v3 pools are fresh: scan from our own deposit block (RPC caps ranges at 10M).
let { deps, wds } = await poolEvents(S.ethPool, depBlock1);
let labels = [...new Set(deps.map((d) => BigInt(d.args._label)))].sort((a, b) => (a < b ? -1 : 1));
if (!labels.map(String).includes((SNARK_FIELD - 1n).toString())) labels.push(SNARK_FIELD - 1n);
labels.sort((a, b) => (a < b ? -1 : 1));
let aspRoot = BigInt(genProof(labels, labels[0]).root);
h = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "updateRoot", args: [aspRoot, "local-v3-asp-46630-swap-leg1-0000"] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("ASP updated for leg 1");
({ deps, wds } = await poolEvents(S.ethPool, depBlock1));
const tree1 = buildTree(deps, wds);
tree1.aspLabels = labels;
const relay1 = await proveAndRelay({
  poolAddress: S.ethPool, entrypoint: S.entrypoint, scope: scopeEth, accountService: svc1,
  commitment: note1, tree: tree1, aspRoot, recipient: account.address, feeRecipient: account.address, feeBPS: 0n, value: parseEther("0.001"),
});

// ---- LEG 3: v4 swap ETH -> VEIL via SwapHelper on the liquid pool ----
const swapIn = parseEther("0.0014");
h = await wallet.writeContract({
  address: SWAPPER, abi: swapAbi, functionName: "swapExactIn",
  args: [{ key: ETH_POOL_KEY, zeroForOne: true, amountIn: swapIn, minOut: parseEther("1"), hookData: "0x", inputToken: ZERO }],
  value: swapIn,
});
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("v4 swap reverted");
console.log("v4 swap ETH->VEIL:", h);
const veilBal = await publicClient.readContract({
  address: S.veilToken, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "o", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
  functionName: "balanceOf", args: [account.address],
});
console.log("VEIL received:", formatEther(veilBal));
if (veilBal < parseEther("1")) throw new Error("Swap output below VEIL pool minimum.");

// ---- LEG 4: shield the VEIL into the v3 VEIL pool ----
const scopeVeil = await publicClient.readContract({ address: S.veilPool, abi: poolAbi, functionName: "SCOPE" });
const svc2 = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: phrase.trim() });
const sec2 = svc2.createDepositSecrets(scopeVeil);
h = await wallet.writeContract({ address: S.veilToken, abi: erc20Abi, functionName: "approve", args: [S.entrypoint, veilBal] });
await publicClient.waitForTransactionReceipt({ hash: h });
h = await wallet.writeContract({ address: S.entrypoint, abi: epAbi, functionName: "deposit", args: [S.veilToken, veilBal, sec2.precommitment] });
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("VEIL shield deposit reverted");
console.log("VEIL shielded:", h, formatEther(veilBal));
writeFileSync(".superpowers/sdd/round2/.swap-note.json", JSON.stringify({ phrase, veilPool: S.veilPool, scope: scopeVeil.toString(), value: veilBal.toString(), nullifier: sec2.nullifier.toString(), secret: sec2.secret.toString(), depositTx: h, depositBlock: rc.blockNumber.toString() }));
console.log("SUCCESS shielded swap ETH -> VEIL end-to-end (legs 1-4)");
console.log(`Explorer deposit: https://explorer.testnet.chain.robinhood.com/tx/${h}`);

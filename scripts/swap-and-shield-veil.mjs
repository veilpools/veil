// TESTNET ONLY (46630). Swaps ETH->VEIL on the liquid pool, shields the
// VEIL output into the v3 VEIL pool. No new ETH deposit. Never mainnet.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient, createWalletClient, custom, encodeAbiParameters, formatEther, parseEther,
} from "viem";
import { privateKeyToAccount, generateMnemonic, english } from "viem/accounts";
import { AccountService, generateMerkleProof } from "@0xbow/privacy-pools-core-sdk";
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
const ZERO = "0x0000000000000000000000000000000000000000";
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
const swapAbi = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8")).abi;
const erc20Abi = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];
const balAbi = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "o", type: "address" }], outputs: [{ name: "", type: "uint256" }] }];

// LEG 3: swap 0.0014 ETH -> VEIL (liquid pool 0x3524). Skip if already swapped.
const swapIn = parseEther("0.0014");
let h;
if (process.argv.includes("--skip-swap")) {
  console.log("skipping v4 swap (already done)");
} else {
  h = await wallet.writeContract({
    address: SWAPPER, abi: swapAbi, functionName: "swapExactIn",
    args: [{ key: { currency0: ZERO, currency1: S.veilToken, fee: 3000, tickSpacing: 60, hooks: ZERO }, zeroForOne: true, amountIn: swapIn, minOut: parseEther("1"), hookData: "0x", inputToken: ZERO }],
    value: swapIn,
  });
  let rc0 = await publicClient.waitForTransactionReceipt({ hash: h });
  if (rc0.status !== "success") throw new Error("v4 swap reverted");
  console.log("v4 swap ETH->VEIL:", h);
}
// Shield a fixed 1.5 VEIL note (never the whole balance).
const veilDeposit = parseEther("1.5");
let rc;

// LEG 4: shield the VEIL into the v3 VEIL pool.
const scopeVeil = await publicClient.readContract({ address: S.veilPool, abi: poolAbi, functionName: "SCOPE" });
const phrase = generateMnemonic(english, 256);
const svc2 = new AccountService({ getDeposits: async () => [], getWithdrawals: async () => [], getRagequits: async () => [] }, { mnemonic: phrase.trim() });
const sec2 = svc2.createDepositSecrets(scopeVeil);
const VEIL_DENOM = parseEther("0.001");
const cfgAbi = [{ type: "function", name: "updatePoolConfiguration", stateMutability: "nonpayable", inputs: [{ name: "_asset", type: "address" }, { name: "_minimumDepositAmount", type: "uint256" }, { name: "_vettingFeeBPS", type: "uint256" }, { name: "_maxRelayFeeBPS", type: "uint256" }], outputs: [] }];
h = await wallet.writeContract({ address: S.entrypoint, abi: cfgAbi, functionName: "updatePoolConfiguration", args: [S.veilToken, VEIL_DENOM, 0n, 100n] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("VEIL pool minDeposit aligned to 0.001");
h = await wallet.writeContract({ address: S.veilToken, abi: erc20Abi, functionName: "approve", args: [S.entrypoint, VEIL_DENOM] });
await publicClient.waitForTransactionReceipt({ hash: h });
const erc20DepositAbi = [{ type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "_asset", type: "address" }, { name: "_value", type: "uint256" }, { name: "_precommitment", type: "uint256" }], outputs: [{ name: "_commitment", type: "uint256" }] }];
h = await wallet.writeContract({ address: S.entrypoint, abi: erc20DepositAbi, functionName: "deposit", args: [S.veilToken, VEIL_DENOM, sec2.precommitment] });
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("VEIL shield deposit reverted");
console.log("VEIL shielded:", h, formatEther(VEIL_DENOM));
writeFileSync(".superpowers/sdd/round2/.swap-veil-note.json", JSON.stringify({
  phrase, veilPool: S.veilPool, scope: scopeVeil.toString(), value: VEIL_DENOM.toString(),
  nullifier: sec2.nullifier.toString(), secret: sec2.secret.toString(),
  depositTx: h, depositBlock: rc.blockNumber.toString(),
}));
console.log("SUCCESS shielded swap ETH -> VEIL (value now shielded in VEIL pool)");
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${h}`);

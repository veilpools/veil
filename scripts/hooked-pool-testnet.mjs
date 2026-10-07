// TESTNET ONLY (46630). Proves ZK-gated hook + protocol fee from REAL usage:
// init v4 pool with VeilHook, add liquidity via helper, ungated swap reverts,
// attested swap succeeds, fee accrues to treasury. Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { VEIL_HOOK_ABI, VEIL_ATTESTATION_REGISTRY_ABI, VEIL_TREASURY_ABI } from "../lib/veil-artifact.mjs";
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

const PM = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const STATE_VIEW = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const MAN = JSON.parse(readFileSync(join(root, "deployments", "hook-gating-testnet-latest.json"), "utf8"));
const HOOK = MAN.hook;
const REGISTRY = MAN.registry;
const TREASURY = MAN.treasury;
const HELPER = "0x3563689bfa8e8f12d6688b35cfc1eef1cd8e2e09";

const key = (process.env.PRIVATE_KEY ?? "").trim();
const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain: robinhoodTestnet, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport });

const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: HOOK };
const INIT_ABI = [{ type: "function", name: "initializePool", stateMutability: "payable", inputs: [{ name: "key", type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }, { name: "sqrtPriceX96", type: "uint160" }], outputs: [{ name: "", type: "int24" }] }];
const POSM = "0x58daec3116aae6d93017baaea7749052e8a04fa7";
const POSM_INIT_ABI = INIT_ABI;

function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) >> 1n; while (y < x) { x = y; y = (x + n / x) >> 1n; } return x; }
const sqrtPriceX96 = isqrt((parseEther("1000") * 2n ** 256n) / parseEther("1")) >> 32n;

let h = await wallet.writeContract({ address: POSM, abi: POSM_INIT_ABI, functionName: "initializePool", args: [poolKey, sqrtPriceX96] });
let rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("hooked pool initialized:", h, rc.status);
if (rc.status !== "success") throw new Error("init reverted");

const art = JSON.parse(readFileSync(join(root, "deployments", "liqhelper-artifact.json"), "utf8"));
h = await wallet.writeContract({
  address: HELPER, abi: art.abi, functionName: "addLiquidity",
  args: [{ key: poolKey, tickLower: -887220, tickUpper: 887220, liquidity: 300000000000000000n, amount0Max: parseEther("0.012"), amount1Max: parseEther("12"), veil: VEIL }],
  value: parseEther("0.012"),
});
rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("hooked pool liquidity:", h, rc.status);
if (rc.status !== "success") throw new Error("liq reverted");

console.log("VEIL allowance already maxed, skipping approve");
rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("hooked pool liquidity:", h, rc.status);
if (rc.status !== "success") throw new Error("hooked liq reverted");

// Gate the pool: 600s launch window.
const POOLKEY_ABI = [{ type: "function", name: "setPoolGating", stateMutability: "nonpayable", inputs: [{ name: "key", type: "tuple", components: [{ name: "currency0", type: "address" }, { name: "currency1", type: "address" }, { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" }] }, { name: "gated", type: "bool" }, { name: "duration", type: "uint256" }], outputs: [] }];
h = await wallet.writeContract({ address: HOOK, abi: POOLKEY_ABI, functionName: "setPoolGating", args: [poolKey, true, 600n] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("pool gated for 600s");

// Attest ourselves.
const proofRoot = keccak256(new TextEncoder().encode(`veil-hook-e2e-${Date.now()}`));
h = await wallet.writeContract({ address: REGISTRY, abi: VEIL_ATTESTATION_REGISTRY_ABI, functionName: "registerAttestation", args: [account.address, proofRoot] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("attested");

// Deploy SwapHelper and prove gating + fee with real swaps.
const swapArt = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8"));
h = await wallet.deployContract({ abi: swapArt.abi, bytecode: swapArt.bytecode, args: [PM] });
rc = await publicClient.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("swap helper deploy reverted");
const SWAPPER = rc.contractAddress;
console.log("swap helper:", SWAPPER, h);

const SWAP_ABI = swapArt.abi;
const TREASURY_BAL_ABI = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "o", type: "address" }], outputs: [{ name: "", type: "uint256" }] }];
const APPROVE_ABI = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];
async function swapAs(inputToken, amountIn, hookData) {
  if (inputToken !== ETH) {
    const ap = await wallet.writeContract({
      address: inputToken, abi: APPROVE_ABI, functionName: "approve", args: [SWAPPER, amountIn],
    });
    const aprc = await publicClient.waitForTransactionReceipt({ hash: ap });
    if (aprc.status !== "success") throw new Error("approve reverted");
  }
  return wallet.writeContract({
    address: SWAPPER, abi: SWAP_ABI, functionName: "swapExactIn",
    args: [{ key: poolKey, zeroForOne: false, amountIn, minOut: 1n, hookData, inputToken }],
    value: 0n,
  });
}

// 1. Ungated swap (empty hookData) MUST revert while gating is active.
let reverted = false;
try {
  const bad = await swapAs(VEIL, 1000000000000000000n, "0x");
  await publicClient.waitForTransactionReceipt({ hash: bad });
} catch {
  reverted = true;
}
console.log("ungated swap reverted:", reverted);
if (!reverted) throw new Error("Gating NOT enforced: ungated swap succeeded.");

// 2. Attested swap succeeds; fee accrues to the treasury.
const { encodeAbiParameters: encHook } = await import("viem");
const hookData = encHook([{ name: "user", type: "address" }], [account.address]);
const tb = await publicClient.getBalance({ address: TREASURY });
import { encodeFunctionData as encSwap2 } from "viem";
const swapCalldata = encSwap2({ abi: SWAP_ABI, functionName: "swapExactIn", args: [{ key: poolKey, zeroForOne: false, amountIn: 1000000000000000000n, minOut: 1n, hookData, inputToken: VEIL }] });
try {
  const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: account.address, to: SWAPPER, data: swapCalldata }, "latest"] }),
  }).then((r) => r.json());
  console.log("SWAP SIM:", JSON.stringify(sim).slice(0, 200));
} catch (e) { console.log("sim failed:", e.message); }
h = await swapAs(VEIL, 1000000000000000000n, hookData);
rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("attested swap:", h, rc.status);
if (rc.status !== "success") throw new Error("attested swap reverted");
const ta = await publicClient.getBalance({ address: TREASURY });
console.log("treasury ETH before/after:", tb.toString(), ta.toString());
if (ta <= tb) throw new Error("No protocol fee accrued to treasury.");
console.log("HOOK GATING + FEE PROVEN ON TESTNET");

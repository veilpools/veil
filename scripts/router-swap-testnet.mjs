// TESTNET ONLY (46630). Proves VeilShieldRouter.swapToShield through the
// liquid ETH/VEIL v4 pool: VEIL in -> ETH out -> keccak pool deposit.
// Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther, keccak256, concatHex, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
import { VEIL_SHIELD_ROUTER_ABI } from "../lib/veil-artifact.mjs";
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

const ROUTER = "0xb1baee8d519a7a2edbaff99eec0ba10948670d68";
const POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";

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

const poolAbi = [
  { type: "function", name: "denomination", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "depositsPaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "nextIndex", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
];
const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];

const [denom, paused, before] = await Promise.all([
  publicClient.readContract({ address: POOL, abi: poolAbi, functionName: "denomination" }),
  publicClient.readContract({ address: POOL, abi: poolAbi, functionName: "depositsPaused" }),
  publicClient.readContract({ address: POOL, abi: poolAbi, functionName: "nextIndex" }),
]);
console.log("pool denom:", denom.toString(), "paused:", paused, "nextIndex:", before);
if (paused) throw new Error("pool paused");

const amountIn = parseEther("2");
let h = await wallet.writeContract({ address: VEIL, abi: erc20, functionName: "approve", args: [ROUTER, amountIn] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("router approved");

const rand32 = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
const nullifier = rand32();
const secret = rand32();
const commitment = keccak256(concatHex([nullifier, secret]));
const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ETH };
const swapArgs = [{ key: poolKey, zeroForOne: false, amountIn, minAmountOut: parseEther("0.0008"), sqrtPriceLimitX96: 14614467034852101032872730522039888242097890n, commitment, shieldedPool: POOL, hookData: "0x" }];
import { encodeFunctionData as encSwap } from "viem";
const swapCalldata = encSwap({ abi: VEIL_SHIELD_ROUTER_ABI, functionName: "swapToShield", args: swapArgs });
const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: account.address, to: ROUTER, data: swapCalldata }, "latest"] }),
}).then((r) => r.json());
console.log("PUBLICNODE SIM:", JSON.stringify(sim).slice(0, 200));
if (sim.error) throw new Error(`Simulation reverts, not sending: ${JSON.stringify(sim.error).slice(0, 200)}`);
h = await wallet.writeContract({
  address: ROUTER, abi: VEIL_SHIELD_ROUTER_ABI, functionName: "swapToShield", args: swapArgs,
});
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("swapToShield:", h, rc.status);
if (rc.status !== "success") throw new Error("swapToShield reverted");
const after = await publicClient.readContract({ address: POOL, abi: poolAbi, functionName: "nextIndex" });
if (after !== before + 1) throw new Error("pool nextIndex did not increment");
console.log(`SUCCESS router swap-to-shield: 2 VEIL -> ETH -> shielded note ${commitment.slice(0, 18)}...`);
console.log(`Explorer: https://explorer.testnet.chain.robinhood.com/tx/${h}`);

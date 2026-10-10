// TESTNET ONLY (46630). Rebalance the unhooked ETH/VEIL v4 pool by swapping
// VEIL->ETH (adds VEIL inventory, lifts VEIL/ETH price back to testable).
// Never mainnet. Simulates before sending; fail-closed on any revert.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rpcRequest } from "./rpc-helper.mjs";

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
if (process.argv.includes("--mainnet")) throw new Error("REFUSING --mainnet: testnet only.");

const PM = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const HELPER = "0x14c27b66fba1b561a920bd03970ae20c53608dff";
const STV = "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b";
const POOLID = "0x3524d46204a0438a67c94e9795818b3b0c5d59869d28865754c4254eb05442e1";
const AMOUNT_IN = parseEther(process.env.REBAL_VEIL ?? "5");

const key = (process.env.PRIVATE_KEY ?? "").trim();
const provider = { async request({ method, params }) {
  const res = await rpcRequest(46630, { jsonrpc: "2.0", id: 1, method, params });
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);
  return res.result;
} };
const chain = { id: 46630, name: "Robinhood Chain Testnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["http://127.0.0.1:1"] } } };
const pub = createPublicClient({ chain, transport: custom(provider) });
if (Number(await pub.getChainId()) !== 46630) throw new Error("REFUSING: not on 46630");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain, transport: custom(provider) });
const root = process.cwd();
const art = JSON.parse(readFileSync(join(root, "deployments", "swaphelper-artifact.json"), "utf8"));

async function price() {
  const r = await pub.readContract({ address: STV, abi: [{ type: "function", name: "getSlot0", stateMutability: "view", inputs: [{ name: "poolId", type: "bytes32" }], outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "protocolFee", type: "uint24" }, { name: "lpFee", type: "uint24" }] }], functionName: "getSlot0", args: [POOLID] });
  const p = Number(r[0]) / 2 ** 96;
  return { veilPerEth: p * p, tick: Number(r[1]) };
}
console.log("price before:", await price());

const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }];
const ah = await wallet.writeContract({ address: VEIL, abi: erc20, functionName: "approve", args: [HELPER, AMOUNT_IN] });
await pub.waitForTransactionReceipt({ hash: ah });
console.log("approved", AMOUNT_IN.toString());

const args = [{ key: { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ETH }, zeroForOne: false, amountIn: AMOUNT_IN, minOut: 1n, sqrtPriceLimitX96: 14614467034852101032872730522039888242097890n, hookData: "0x", inputToken: VEIL }];
// Simulate exact calldata first (fail closed, no tx on revert).
await pub.simulateContract({ address: HELPER, abi: art.abi, functionName: "swapExactIn", args, account: account.address });
console.log("sim OK");
const h = await wallet.writeContract({ address: HELPER, abi: art.abi, functionName: "swapExactIn", args });
const rc = await pub.waitForTransactionReceipt({ hash: h });
if (rc.status !== "success") throw new Error("swap reverted: " + h);
console.log("REBALANCE SWAP LIVE:", h);
console.log("price after:", await price());

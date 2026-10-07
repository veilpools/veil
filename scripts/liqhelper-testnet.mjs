// TESTNET ONLY (46630). Deploys TestnetLiquidityHelper and adds dust
// liquidity to the ETH/VEIL v4 pool. Never mainnet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, custom, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet } from "../lib/chains.mjs";
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

const art = JSON.parse(readFileSync(join(root, "deployments", "liqhelper-artifact.json"), "utf8"));
let h = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode, args: [PM] });
let depRc = await publicClient.waitForTransactionReceipt({ hash: h });
if (depRc.status !== "success") throw new Error("helper deploy reverted");
const helperV2 = depRc.contractAddress;
console.log("helper:", helperV2, h);

const erc20 = [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }];
h = await wallet.writeContract({ address: VEIL, abi: erc20, functionName: "approve", args: [helperV2, parseEther("20")] });
await publicClient.waitForTransactionReceipt({ hash: h });
console.log("VEIL approved to helper");

const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: ETH };
const helperAbi = art.abi;
const liqArgs = [{ key: poolKey, tickLower: -887220, tickUpper: 887220, liquidity: 300000000000000000n, amount0Max: parseEther("0.012"), amount1Max: parseEther("12"), veil: VEIL }];
import { encodeFunctionData as encLiq } from "viem";
const liqCalldata = encLiq({ abi: helperAbi, functionName: "addLiquidity", args: liqArgs });
const sim = await fetch("https://robinhood-sepolia-rpc.publicnode.com", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ from: account.address, to: helperV2, data: liqCalldata, value: "0x2386f26fc10000" }, "latest"] }),
}).then((r) => r.json());
console.log("PUBLICNODE SIM:", JSON.stringify(sim).slice(0, 200));
if (sim.error) throw new Error(`Simulation reverts, not sending: ${JSON.stringify(sim.error).slice(0, 200)}`);
h = await wallet.writeContract({ address: helperV2, abi: helperAbi, functionName: "addLiquidity", args: liqArgs, value: parseEther("0.012") });
const rc = await publicClient.waitForTransactionReceipt({ hash: h });
console.log("liquidity added:", h, rc.status);
if (rc.status !== "success") throw new Error("addLiquidity reverted");
console.log("HELPER LIQUIDITY DONE", helperV2);

// TESTNET ONLY. Sends addLiquidity with explicit gas (no estimation).
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
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH = "0x0000000000000000000000000000000000000000";
const HOOK = "0xbebfc3048c7ced099337abe46e56189fa63420c4";
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
const art = JSON.parse(readFileSync(join(root, "deployments", "liqhelper-artifact.json"), "utf8"));
const poolKey = { currency0: ETH, currency1: VEIL, fee: 3000, tickSpacing: 60, hooks: HOOK };
const h = await wallet.sendTransaction({
  to: HELPER,
  data: (await import("viem")).encodeFunctionData({
    abi: art.abi, functionName: "addLiquidity",
    args: [{ key: poolKey, tickLower: -887220, tickUpper: 887220, liquidity: 300000000000000000n, amount0Max: parseEther("0.012"), amount1Max: parseEther("12"), veil: VEIL }],
  }),
  value: parseEther("0.012"),
  gas: 2000000n,
  maxFeePerGas: 20000000000n,
  maxPriorityFeePerGas: 1000000000n,
});
console.log("sent:", h);
const rc = await publicClient.waitForTransactionReceipt({ hash: h, timeout: 120000, confirmations: 1 });
console.log("liquidity:", h, rc.status);

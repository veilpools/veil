// Wires the temporary VeilToken into the VeilTreasury and proves
// the full fee-to-burn loop: setVeilToken, fund treasury, executeBurn.
// Usage: node scripts/wire-treasury-testnet.mjs [--mainnet]
import { createPublicClient, createWalletClient, custom, parseAbi, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodTestnet, robinhoodMainnet } from "../lib/chains.mjs";
import { rpcRequest } from "./rpc-helper.mjs";
import { VEIL_TREASURY_ABI } from "../lib/veil-artifact.mjs";
import fs from "node:fs";

function loadEnvFile(path) {
  try {
    for (const rawLine of fs.readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.split("#")[0].trim();
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  } catch {}
}
loadEnvFile(".env.mainnet.local");
loadEnvFile(".env.local");

const useMainnet = process.argv.includes("--mainnet");
const net = useMainnet ? "mainnet" : "testnet";
const chainId = useMainnet ? 4663 : 46630;
const chain = useMainnet ? robinhoodMainnet : robinhoodTestnet;
const manifest = JSON.parse(fs.readFileSync(`deployments/veiltoken-${net}-latest.json`, "utf8"));
const TOKEN = manifest.address;
const mainnet = JSON.parse(fs.readFileSync("deployments/mainnet-latest.json", "utf8"));
const TREASURY = useMainnet
  ? mainnet.contracts.VeilTreasury.address
  : "0x491413119a4adb0ea23b902c7fc7cee3845542b2";

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(chainId, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const transport = custom(provider);
const publicClient = createPublicClient({ chain, transport });
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const wallet = createWalletClient({ account, chain, transport });
const erc20 = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

const FUND = 10000n * 10n ** 18n;
const BURN = 1000n * 10n ** 18n;

let h = await wallet.writeContract({
  address: TREASURY, abi: VEIL_TREASURY_ABI, functionName: "setVeilToken", args: [TOKEN],
});
console.log("setVeilToken:", h);
await publicClient.waitForTransactionReceipt({ hash: h });

h = await wallet.writeContract({
  address: TOKEN, abi: erc20, functionName: "transfer", args: [TREASURY, FUND],
});
console.log("fund treasury:", h);
await publicClient.waitForTransactionReceipt({ hash: h });

const supplyBefore = await publicClient.readContract({ address: TOKEN, abi: erc20, functionName: "totalSupply" });
h = await wallet.writeContract({
  address: TREASURY, abi: VEIL_TREASURY_ABI, functionName: "executeBurn", args: [BURN],
});
console.log("executeBurn:", h);
const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: h });
if (burnReceipt.status !== "success") throw new Error("executeBurn reverted");

const [supplyAfter, totalBurned, share] = await Promise.all([
  publicClient.readContract({ address: TOKEN, abi: erc20, functionName: "totalSupply" }),
  publicClient.readContract({ address: TREASURY, abi: VEIL_TREASURY_ABI, functionName: "totalBurned" }),
  publicClient.readContract({ address: TREASURY, abi: VEIL_TREASURY_ABI, functionName: "buybackShareBps" }),
]);
console.log("totalSupply before:", formatEther(supplyBefore));
console.log("totalSupply after:", formatEther(supplyAfter));
console.log("treasury totalBurned:", formatEther(totalBurned));
console.log("buybackShareBps:", share.toString());
if (supplyBefore - supplyAfter !== BURN) throw new Error("Supply did not decrease by burn amount");
console.log("END-TO-END BURN PROVEN");

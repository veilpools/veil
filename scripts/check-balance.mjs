// scripts/check-balance.mjs
import { rpcCall } from "./rpc-helper.mjs";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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

const key = process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing MAINNET_PRIVATE_KEY or PRIVATE_KEY in env");
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
console.log("Account Address:", account.address);

for (const chainId of [46630, 4663]) {
  try {
    const bal = await rpcCall(chainId, "eth_getBalance", [account.address, "latest"]);
    console.log(`Chain ${chainId} Balance: ${formatEther(BigInt(bal))} ETH`);
    const block = await rpcCall(chainId, "eth_blockNumber", []);
    console.log(`Chain ${chainId} Block: ${BigInt(block).toString()}`);
  } catch (e) {
    console.error(`Chain ${chainId} check failed:`, e.message);
  }
}

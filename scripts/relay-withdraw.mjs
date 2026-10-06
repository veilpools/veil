// scripts/relay-withdraw.mjs
// Usage: node scripts/relay-withdraw.mjs <proofHex> <root> <nullifierHash> <recipient> <feeWei>
// Pays gas from RELAYER_KEY and collects <feeWei>. All params are logged.
// Transport goes through scripts/rpc-helper.mjs (IP bypass), never direct RPC.
import { createWalletClient, custom, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet } from "../lib/chains.mjs";
import { rpcRequest } from "./rpc-helper.mjs";
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

const [proofHex, root, nullifierHash, recipient, feeWei] = process.argv.slice(2);
if (!proofHex || !root || !nullifierHash || !recipient) {
  throw new Error("Usage: node scripts/relay-withdraw.mjs <proofHex> <root> <nullifierHash> <recipient> <feeWei>");
}
const key = process.env.RELAYER_KEY || process.env.MAINNET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!key) throw new Error("Missing RELAYER_KEY or PRIVATE_KEY in env");
const pool = process.env.NEXT_PUBLIC_PRIVACY_POOL_ETH;
if (!pool) throw new Error("Missing NEXT_PUBLIC_PRIVACY_POOL_ETH in env");

const provider = {
  async request({ method, params }) {
    const res = await rpcRequest(4663, { jsonrpc: "2.0", id: 1, method, params });
    if (res.error) throw new Error(`RPC error: ${res.error.message}`);
    return res.result;
  },
};
const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
const client = createWalletClient({
  account,
  chain: robinhoodMainnet,
  transport: custom(provider),
});
const abi = parseAbi(["function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, uint256 fee)"]);
if (!/^0x[0-9a-fA-F]{40}$/.test(pool)) throw new Error("Invalid pool address");
if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || recipient === "0x0000000000000000000000000000000000000000") {
  throw new Error("Invalid recipient address");
}
for (const [name, v] of [["root", root], ["nullifierHash", nullifierHash]]) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`Invalid ${name} hex`);
}
if (!/^0x[0-9a-fA-F]+$/.test(proofHex) || proofHex.length < 10) throw new Error("Invalid proof hex");
console.log(JSON.stringify({ pool, root, nullifierHash, recipient, feeWei: feeWei || "0" }));
const hash = await client.writeContract({
  address: pool,
  abi,
  functionName: "withdraw",
  args: [proofHex, root, nullifierHash, recipient, BigInt(feeWei || "0")],
});
console.log("Withdraw hash:", hash);

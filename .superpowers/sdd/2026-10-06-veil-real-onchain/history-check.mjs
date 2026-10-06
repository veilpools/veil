// Read-only mainnet activity check for the deployer. No keys used.
import https from "node:https";
import { rpcCall } from "../../../scripts/rpc-helper.mjs";

const ADDR = "0xCdbdc82A021071eE445d9f897433a7E4B4EAfD8d";

function get(host, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "172.66.147.70",
        port: 443,
        path,
        method: "GET",
        headers: { Host: host, "User-Agent": "Mozilla/5.0" },
        servername: host,
        timeout: 20000,
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

const nonce = await rpcCall(4663, "eth_getTransactionCount", [ADDR, "latest"]);
console.log("mainnet nonce:", BigInt(nonce).toString());
const bal = await rpcCall(4663, "eth_getBalance", [ADDR, "latest"]);
console.log("mainnet balance wei:", BigInt(bal).toString());
const txs = await get("explorer.mainnet.chain.robinhood.com", `/api/v2/addresses/${ADDR}/transactions?limit=10`);
try {
  const j = JSON.parse(txs);
  for (const t of j.items ?? []) {
    console.log(t.timestamp, t.hash.slice(0, 18), "from:", t.from.hash.slice(0, 12), "to:", (t.to?.hash ?? "CREATE").slice(0, 12), "value:", t.value, "fee:", t.fee?.value);
  }
} catch {
  console.log("tx list parse fail:", txs.slice(0, 150));
}

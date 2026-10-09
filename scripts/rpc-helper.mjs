// scripts/rpc-helper.mjs
// Shared Robinhood Chain RPC client. Uses the Cloudflare Anycast edge IP
// with an explicit Host header, mirroring app/api/rpc/route.ts.
import https from "node:https";

export const ROBINHOOD_RPC_IP = "172.66.147.70";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

// Direct upstream for testnet when configured (e.g. QuickNode). Server-only
// env on purpose: the URL holds a private token. Falls back to IP bypass.
const DIRECT_TESTNET_RPC =
  process.env.TESTNET_RPC_URL || process.env.NEXT_PUBLIC_TESTNET_RPC_URL || "";

export function targetHostFor(chainId) {
  return chainId === 46630
    ? "rpc.testnet.chain.robinhood.com"
    : "rpc.mainnet.chain.robinhood.com";
}

export function rpcRequest(chainId, payload, timeoutMs = 15000) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  // Fast path: dedicated testnet endpoint skips the IP bypass.
  if (chainId === 46630 && DIRECT_TESTNET_RPC) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(DIRECT_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body,
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timer);
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`RPC parse error: ${text.slice(0, 200)}`);
        }
      })
      .catch((e) => {
        clearTimeout(timer);
        throw e;
      });
  }
  const targetHost = targetHostFor(chainId);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ROBINHOOD_RPC_IP,
        port: 443,
        path: "/",
        method: "POST",
        headers: {
          Host: targetHost,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": UA,
        },
        servername: targetHost,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`RPC parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("RPC timeout")));
    req.write(body);
    req.end();
  });
}

export async function rpcCall(chainId, method, params = []) {
  const res = await rpcRequest(chainId, { jsonrpc: "2.0", id: 1, method, params });
  if (res.error) throw new Error(`RPC error: ${res.error.message}`);
  return res.result;
}

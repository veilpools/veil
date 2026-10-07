import https from "node:https";
import { custom } from "viem";

export const ROBINHOOD_RPC_IP = "172.66.147.70";

export function createBypassTransport(chainId: number) {
  const targetHost =
    chainId === 46630
      ? "rpc.testnet.chain.robinhood.com"
      : "rpc.mainnet.chain.robinhood.com";

  return custom({
    async request({ method, params }) {
      const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
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
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            servername: targetHost,
            timeout: 15000,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  reject(new Error(parsed.error.message || "RPC Error"));
                } else {
                  resolve(parsed.result);
                }
              } catch {
                reject(new Error(`Failed to parse RPC response: ${data.slice(0, 100)}`));
              }
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => req.destroy(new Error("RPC request timed out")));
        req.write(body);
        req.end();
      });
    },
  });
}

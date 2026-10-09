import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import {
  findDisallowedMethod,
  isAllowedChain,
  RPC_MAX_BODY_BYTES,
  RpcRateLimiter,
} from "@/lib/rpc-guard";

// Cloudflare Anycast edge IP for Robinhood Chain RPC (bypasses local ISP DNS poisoning & Cloudflare block)
const ROBINHOOD_RPC_IP = "172.66.147.70";

// Direct upstream for testnet when configured (e.g. QuickNode). Server-only
// env on purpose: the URL holds a private token and must not leak into the
// client bundle via a NEXT_PUBLIC_ var. Falls back to the IP bypass below.
const TESTNET_DIRECT_RPC =
  process.env.TESTNET_RPC_URL || process.env.NEXT_PUBLIC_TESTNET_RPC_URL || "";

// Root-audit hardening (2026-10-08, deep-audit tuned to 600/min after a
// same-day 429 incident starved the trade page): this route used to forward ANY JSON-RPC
// body verbatim (open-proxy abuse: getLogs range bombs, quota drain). Guards
// live in lib/rpc-guard.ts (unit-tested): explicit chain allowlist (no silent
// mainnet fallback), read-only method allowlist (no send/trace/debug/txpool),
// 256 KB body cap (single or batch), best-effort per-IP rate limit
// (120 req/min; serverless memory, resets on cold start — a WAF belongs in
// front for production).
const limiter = new RpcRateLimiter();

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainParam = searchParams.get("chainId");
  if (!isAllowedChain(chainParam)) {
    return NextResponse.json({ error: "chainId must be 46630 or 4663" }, { status: 400 });
  }
  const chainId = Number(chainParam);
  const targetHost = chainId === 4663 ? "rpc.mainnet.chain.robinhood.com" : "rpc.testnet.chain.robinhood.com";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (limiter.check(ip)) {
    return NextResponse.json({ error: "rate limited, retry shortly" }, { status: 429 });
  }

  const body = await req.text();
  if (Buffer.byteLength(body) > RPC_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "request too large" }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const blocked = findDisallowedMethod(payload);
  if (blocked !== null) {
    const calls = Array.isArray(payload) ? payload : [payload];
    const bad = calls[blocked.index];
    const id =
      typeof bad === "object" && bad !== null
        ? (bad as Record<string, unknown>).id ?? null
        : null;
    return rpcError(id, -32601, `Method not allowed: ${blocked.method}`);
  }

  // Fast path: dedicated testnet endpoint (QuickNode) skips the IP bypass.
  // Guards above (chain/method/body/rate-limit) still apply.
  if (chainId === 46630 && TESTNET_DIRECT_RPC) {
    try {
      const upstream = await fetch(TESTNET_DIRECT_RPC, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      const data = await upstream.text();
      return new NextResponse(data, {
        status: upstream.status || 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json({ jsonrpc: "2.0", id: 1, error: { message: "upstream unavailable" } }, { status: 502 });
    }
  }

  return new Promise<NextResponse>((resolve) => {
    const clientReq = https.request(
      {
        hostname: ROBINHOOD_RPC_IP,
        port: 443,
        path: "/",
        method: "POST",
        headers: {
          Host: targetHost,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        servername: targetHost,
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve(
            new NextResponse(data, {
              status: res.statusCode || 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              },
            })
          );
        });
      }
    );

    clientReq.on("error", () => {
      resolve(NextResponse.json({ jsonrpc: "2.0", id: 1, error: { message: "upstream unavailable" } }, { status: 502 }));
    });

    clientReq.write(body);
    clientReq.end();
  });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    network: "Robinhood Chain Mainnet",
    chainId: 4663,
  });
}

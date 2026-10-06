import { NextRequest, NextResponse } from "next/server";

const ROBINHOOD_RPC = process.env.ROBINHOOD_MAINNET_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(ROBINHOOD_RPC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "RPC proxy error";
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message } },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    network: "Robinhood Chain Mainnet",
    chainId: 4663,
  });
}

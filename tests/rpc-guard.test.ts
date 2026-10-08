import { describe, expect, it } from "vitest";
import {
  findDisallowedMethod,
  isAllowedChain,
  RPC_MAX_BODY_BYTES,
  RpcRateLimiter,
} from "../lib/rpc-guard";

describe("RPC guard (root-audit open-proxy hardening)", () => {
  it("allows only explicit testnet/mainnet chain params, never silent fallback", () => {
    expect(isAllowedChain("46630")).toBe(true);
    expect(isAllowedChain("4663")).toBe(true);
    expect(isAllowedChain(null)).toBe(false);
    expect(isAllowedChain("")).toBe(false);
    expect(isAllowedChain("1")).toBe(false);
    expect(isAllowedChain("46631")).toBe(false);
  });

  it("passes read-only methods, single and batch", () => {
    expect(findDisallowedMethod({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [] })).toBeNull();
    expect(
      findDisallowedMethod([
        { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_getLogs", params: [] },
      ])
    ).toBeNull();
  });

  it("blocks sends, traces, debug, subscriptions with the batch index", () => {
    for (const method of [
      "eth_sendRawTransaction",
      "eth_sendTransaction",
      "debug_traceCall",
      "trace_call",
      "eth_subscribe",
      "txpool_content",
      "net_version",
    ]) {
      const hit = findDisallowedMethod({ jsonrpc: "2.0", id: 7, method, params: [] });
      expect(hit?.method).toBe(method);
      expect(hit?.index).toBe(0);
    }
    const batch = findDisallowedMethod([
      { jsonrpc: "2.0", id: 1, method: "eth_call", params: [] },
      { jsonrpc: "2.0", id: 2, method: "eth_sendRawTransaction", params: [] },
    ]);
    expect(batch).toEqual({ method: "eth_sendRawTransaction", index: 1 });
    // Malformed calls fail closed.
    expect(findDisallowedMethod({ jsonrpc: "2.0", id: 1 })).not.toBeNull();
    expect(findDisallowedMethod(null)).not.toBeNull();
  });

  it("rate-limits per IP with a sliding window", () => {
    const limiter = new RpcRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 600; i++) {
      expect(limiter.check("1.2.3.4", t0 + i * 50)).toBe(false);
    }
    expect(limiter.check("1.2.3.4", t0 + 30_000)).toBe(true);
    // Another IP is unaffected.
    expect(limiter.check("5.6.7.8", t0 + 12_000)).toBe(false);
    // Window slides: after 60s the bucket drains.
    expect(limiter.check("1.2.3.4", t0 + 61_000 + 12_000)).toBe(false);
  });

  it("caps bodies at 256 KB", () => {
    expect(RPC_MAX_BODY_BYTES).toBe(256_000);
  });
});

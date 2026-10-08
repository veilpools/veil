// Pure RPC-guard helpers for app/api/rpc/route.ts (root-audit 2026-10-08).
// Kept dependency-free so unit tests cover the security boundary directly.

export const RPC_READ_METHODS: ReadonlySet<string> = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBlockByNumber",
  "eth_getBalance",
  "eth_getCode",
  "eth_gasPrice",
  "eth_call",
  "eth_estimateGas",
  "eth_getLogs",
  "eth_getTransactionReceipt",
]);

export const RPC_MAX_BODY_BYTES = 256_000;
export const RPC_RATE_WINDOW_MS = 60_000;
export const RPC_RATE_MAX = 120;

/** Chain allowlist: explicit testnet/mainnet only, never silent fallback. */
export function isAllowedChain(chainParam: string | null): boolean {
  return chainParam === "46630" || chainParam === "4663";
}

/** Every JSON-RPC call in the payload (single or batch) must be read-only.
 * Returns the offending method and its batch index, or null when clean. */
export function findDisallowedMethod(payload: unknown): { method: string; index: number } | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const method =
      call && typeof call === "object"
        ? (call as Record<string, unknown>).method
        : undefined;
    if (typeof method !== "string" || !RPC_READ_METHODS.has(method)) {
      return { method: String(method), index: i };
    }
  }
  return null;
}

/** Best-effort per-IP sliding-window limiter (serverless memory). */
export class RpcRateLimiter {
  private buckets = new Map<string, number[]>();

  /** Returns true when the request must be rejected with 429. */
  check(ip: string, now: number = Date.now()): boolean {
    const bucket = (this.buckets.get(ip) ?? []).filter((t) => now - t < RPC_RATE_WINDOW_MS);
    bucket.push(now);
    this.buckets.set(ip, bucket);
    if (this.buckets.size > 5000) this.buckets.clear();
    return bucket.length > RPC_RATE_MAX;
  }

  size(): number {
    return this.buckets.size;
  }
}

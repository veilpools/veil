import { createPublicClient, http, formatEther, formatUnits, parseAbi, type Address } from "viem";
import { appChain, APP_CHAIN_ID } from "./chains";

// Read from local Next.js proxy route in browser, or direct RPC in server/tests
const RPC_ENDPOINT =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/rpc?chainId=${APP_CHAIN_ID}`
    : process.env.ROBINHOOD_MAINNET_RPC_URL || appChain.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
  chain: appChain,
  transport: http(RPC_ENDPOINT, {
    fetchOptions: {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    },
  }),
});

const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export interface TokenBalanceInfo {
  symbol: string;
  formatted: string;
  raw: bigint;
}

export async function fetchAllTokenBalances(
  userAddress: Address,
  tokens: { symbol: string; address: string; decimals: number }[]
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  try {
    // 1. Fetch native ETH balance
    const ethBalance = await publicClient.getBalance({ address: userAddress });
    result["ETH"] = parseFloat(formatEther(ethBalance)).toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 4,
    });
  } catch {
    result["ETH"] = "0.000";
  }

  // 2. Fetch ERC20 balances in parallel
  for (const t of tokens) {
    if (!t.address) result[t.symbol] = "—";
  }
  const promises = tokens
    .filter((t) => t.symbol !== "ETH" && t.address && t.address !== "0x0000000000000000000000000000000000000000")
    .map(async (token) => {
      try {
        const bal = await publicClient.readContract({
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        const formatted = formatUnits(bal, token.decimals);
        const num = parseFloat(formatted);
        result[token.symbol] = num.toLocaleString(undefined, {
          minimumFractionDigits: token.decimals === 6 ? 2 : 2,
          maximumFractionDigits: 2,
        });
      } catch {
        result[token.symbol] = "0.00";
      }
    });

  await Promise.allSettled(promises);
  return result;
}

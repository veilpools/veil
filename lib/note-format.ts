import { formatEther, formatUnits } from "viem";
import { SUPPORTED_TOKENS } from "../components/TokenSelectModal";
import { TESTNET_VEIL_TOKEN } from "./router-swap";

// Canonical zero address for native-ETH notes/pools (moved from
// app/trade/page.tsx during modularization).
export const ETH_ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

// Pool tokens not listed in SUPPORTED_TOKENS (e.g. test VEIL has no faucet
// entry) still need correct labels — a mislabeled VEIL note reads as ETH.
const KNOWN_ASSETS: Readonly<Record<string, { symbol: string; decimals: number }>> = {
  [TESTNET_VEIL_TOKEN.toLowerCase()]: { symbol: "VEIL", decimals: 18 },
};

// Display helpers for shielded-note amounts/symbols. Pure (read-only token
// registry); extracted from app/trade/page.tsx during modularization.

export function formatNoteAmount(denomination: bigint, asset?: string): string {
  if (!asset) return `${formatEther(denomination)} ETH`;
  const known = KNOWN_ASSETS[asset.toLowerCase()];
  if (known) {
    return known.decimals === 6
      ? `${formatUnits(denomination, 6)} ${known.symbol}`
      : `${formatEther(denomination)} ${known.symbol}`;
  }
  const match = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === asset.toLowerCase());
  if (match) {
    if (match.decimals === 6) {
      return `${formatUnits(denomination, 6)} ${match.symbol}`;
    }
    return `${formatEther(denomination)} ${match.symbol}`;
  }
  return `${formatEther(denomination)} ETH`;
}

export function getNoteAssetSymbol(asset?: string): string {
  if (!asset) return "ETH";
  const known = KNOWN_ASSETS[asset.toLowerCase()];
  if (known) return known.symbol;
  const match = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === asset.toLowerCase());
  return match ? match.symbol : "ETH";
}

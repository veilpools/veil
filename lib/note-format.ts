import { formatEther, formatUnits } from "viem";
import { SUPPORTED_TOKENS } from "../components/TokenSelectModal";

// Display helpers for shielded-note amounts/symbols. Pure (read-only token
// registry); extracted from app/trade/page.tsx during modularization.

export function formatNoteAmount(denomination: bigint, asset?: string): string {
  if (!asset) return `${formatEther(denomination)} ETH`;
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
  const match = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === asset.toLowerCase());
  return match ? match.symbol : "ETH";
}

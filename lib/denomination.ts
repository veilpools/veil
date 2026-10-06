import { parseEther, parseUnits } from "viem";

// Fixed ShieldedPool denominations. Must match the deployed pool configs.
// Unknown tokens fall back to the ETH pool denomination.
export function getDenominationForToken(symbol: string, decimals: number): bigint {
  const s = symbol.toUpperCase();
  if (s === "VEIL" || s === "PONS") return parseEther("1000");
  if (s === "QUANTA" || s === "QNTA") return parseEther("100");
  if (decimals === 6) return parseUnits("100", 6);
  return parseEther("0.001");
}

import { describe, it, expect } from "vitest";
import {
  findLegacyPoolsForAsset,
  type LegacyPoolCandidate,
} from "../lib/legacy-pool-resolve";

const ETH = "0x0000000000000000000000000000000000000000";
const VEIL = "0x019086f63407fadf0ccb89516e465baef5031aa9";
const ETH_POOL = "0x1b1d39e4da649747ecc0e93e7a06452a3061de17";
const V05 = "0xd73920a3cbfdf3f6be530cab73fc9c876619517a";
const V2 = "0x172e9cc542cf9349813f74548eec6e0a1df65e17";

const CANDIDATES: LegacyPoolCandidate[] = [
  { pool: ETH_POOL, asset: ETH },
  { pool: V05, asset: VEIL },
  { pool: V2, asset: VEIL },
];

describe("legacy pool asset matcher", () => {
  it("matches the ETH pool for the zero address", () => {
    expect(findLegacyPoolsForAsset(CANDIDATES, ETH)).toEqual([ETH_POOL]);
  });

  it("matches BOTH VEIL pools in preference order", () => {
    expect(findLegacyPoolsForAsset(CANDIDATES, VEIL)).toEqual([V05, V2]);
  });

  it("matches case-insensitively", () => {
    expect(findLegacyPoolsForAsset(CANDIDATES, VEIL.toUpperCase())).toEqual([V05, V2]);
  });

  it("returns empty for unknown assets (fail closed downstream)", () => {
    expect(
      findLegacyPoolsForAsset(CANDIDATES, "0x000000000000000000000000000000000000dEaD")
    ).toEqual([]);
    expect(findLegacyPoolsForAsset([], VEIL)).toEqual([]);
  });
});

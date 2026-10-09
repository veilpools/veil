import { describe, it, expect } from "vitest";

const LEGACY_POOLS = [
  "0x1b1d39e4da649747ecc0e93e7a06452a3061de17",
  "0xd73920a3cbfdf3f6be530cab73fc9c876619517a",
  "0x172e9cc542cf9349813f74548eec6e0a1df65e17",
];

describe("legacy freeze list", () => {
  it("covers exactly the three legacy pools", () => {
    expect(LEGACY_POOLS).toHaveLength(3);
    for (const a of LEGACY_POOLS) expect(a).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

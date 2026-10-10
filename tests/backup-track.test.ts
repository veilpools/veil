import { describe, it, expect } from "vitest";
import {
  BACKED_UP_NULLIFIERS_KEY,
  loadBackedUpNullifiers,
  markNullifierBackedUp,
  isNullifierBackedUp,
  type NullifierStore,
} from "../lib/backup-track";

function memStore(seed?: string): NullifierStore & { dump(): string | null } {
  let v: string | null = seed ?? null;
  return {
    getItem: () => v,
    setItem: (_k, val: string) => {
      v = val;
    },
    dump: () => v,
  };
}

describe("backup tracking (withdraw gate)", () => {
  it("starts empty and records exports", () => {
    const s = memStore();
    expect(loadBackedUpNullifiers(s).size).toBe(0);
    markNullifierBackedUp(s, "0xabc");
    expect(isNullifierBackedUp(loadBackedUpNullifiers(s), "0xabc")).toBe(true);
    expect(isNullifierBackedUp(loadBackedUpNullifiers(s), "0xdef")).toBe(false);
  });
  it("dedups and survives reload", () => {
    const s = memStore();
    markNullifierBackedUp(s, "0xabc");
    markNullifierBackedUp(s, "0xabc");
    const reloaded = loadBackedUpNullifiers(s);
    expect(reloaded.size).toBe(1);
    expect(JSON.parse(s.dump() ?? "[]")).toEqual(["0xabc"]);
  });
  it("tolerates corrupt storage without throwing", () => {
    const s = memStore("{not-json");
    expect(loadBackedUpNullifiers(s).size).toBe(0);
    expect(markNullifierBackedUp(s, "0x1")).toEqual(["0x1"]);
  });
  it("uses the stable storage key", () => {
    expect(BACKED_UP_NULLIFIERS_KEY).toBe("veil_backed_up_nullifiers_v1");
  });
});

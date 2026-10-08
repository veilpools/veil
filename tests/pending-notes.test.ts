import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingNoteByTx,
  loadPendingNotes,
  savePendingNote,
  type AnyShieldedNote,
} from "../lib/note";

// Minimal localStorage stub (vitest node env has none).
function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", {});
}

const NOTE = {
  secret: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  nullifier: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  nullifierHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  commitment: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  denomination: 1000000000000000n,
  timestamp: 123,
  asset: "0x0000000000000000000000000000000000000000",
} as unknown as AnyShieldedNote;

describe("pending-note journal (root-audit F5 anti-dust)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  it("starts empty outside a browser", () => {
    vi.unstubAllGlobals();
    expect(loadPendingNotes()).toEqual([]);
  });

  it("journals, reloads, and clears by tx hash", () => {
    expect(loadPendingNotes()).toEqual([]);
    savePendingNote(NOTE, "0xhash1", "0xpool");
    const loaded = loadPendingNotes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].txHash).toBe("0xhash1");
    expect(loaded[0].nullifier).toBe(NOTE.nullifier);
    expect(loaded[0].pool).toBe("0xpool");
    // Re-journal same nullifier overwrites instead of duplicating.
    savePendingNote(NOTE, "0xhash2", "0xpool");
    expect(loadPendingNotes()).toHaveLength(1);
    expect(loadPendingNotes()[0].txHash).toBe("0xhash2");
    clearPendingNoteByTx("0xHASH2");
    expect(loadPendingNotes()).toEqual([]);
  });

  it("drops corrupt journal content instead of bricking", () => {
    localStorage.setItem(
      "veil_pending_notes_v1",
      JSON.stringify([{ payload: 42 }, null, "x"])
    );
    expect(loadPendingNotes()).toEqual([]);
    localStorage.setItem("veil_pending_notes_v1", "not-json{{{");
    expect(loadPendingNotes()).toEqual([]);
  });
});

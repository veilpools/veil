export const BACKED_UP_NULLIFIERS_KEY = "veil_backed_up_nullifiers_v1";

export interface NullifierStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readStore(store: NullifierStore | undefined): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(BACKED_UP_NULLIFIERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Nullifiers the user demonstrably backed up (export copy or file restore). */
export function loadBackedUpNullifiers(store?: NullifierStore): Set<string> {
  return new Set(readStore(store));
}

/** Record a backup; returns the stored list. Never throws (storage may deny). */
export function markNullifierBackedUp(store: NullifierStore | undefined, nullifier: string): string[] {
  const list = readStore(store);
  if (!list.includes(nullifier)) list.push(nullifier);
  try {
    store?.setItem(BACKED_UP_NULLIFIERS_KEY, JSON.stringify(list));
  } catch {
    // Denied storage must never block the flow; the in-memory set still applies.
  }
  return list;
}

export function isNullifierBackedUp(set: ReadonlySet<string>, nullifier: string): boolean {
  return set.has(nullifier);
}

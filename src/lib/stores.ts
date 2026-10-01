import type { StoreProfile } from "./types";

export function storeDisplayName(store: {
  storeName?: string;
  name?: string;
}) {
  return String(store.storeName || store.name || "").trim();
}

export function storeIdentity(store: {
  _id?: unknown;
  storeName?: unknown;
  name?: unknown;
  marks?: unknown;
}) {
  const name = String(store.storeName || store.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!name) return `id:${String(store._id || "")}`;
  const marks = String(store.marks || "")
    .trim()
    .toLowerCase();
  return `${name}::${marks}`;
}

export function uniqueStores(stores: StoreProfile[]) {
  const byKey = new Map<string, StoreProfile>();
  for (const store of stores) {
    const key = storeIdentity(store);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, store);
      continue;
    }
    const currentTemp = Boolean(current.isTemp || current.isTempStore);
    const nextTemp = Boolean(store.isTemp || store.isTempStore);
    if (currentTemp && !nextTemp) byKey.set(key, store);
  }
  return [...byKey.values()].sort((a, b) =>
    storeDisplayName(a).localeCompare(storeDisplayName(b)),
  );
}

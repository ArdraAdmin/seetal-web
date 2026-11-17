import type { Product, StoreProfile } from "./types";

/** Normalized match for the SHMP store "SARVAH HOMES L L C" (and close variants). */
export function isSarvahHomesStoreName(name: string) {
  const token = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return token.includes("sarvahhomes");
}

export function isSarvahHomesStore(store: {
  storeName?: string | null;
  name?: string | null;
}) {
  return isSarvahHomesStoreName(
    String(store.storeName || store.name || ""),
  );
}

/** Under the Sarvah salesman card, also surface the SHMP Sarvah Homes store. */
export function shouldShowSarvahHomesUnderSarvah(
  workspace: string | null | undefined,
) {
  return String(workspace || "").trim().toLowerCase() === "sarvah";
}

/**
 * On every Sarvah-card store, also show manufacturing products assigned to
 * the SHMP Sarvah Homes store.
 */
export function shouldMergeSarvahHomesInventory(
  workspace: string | null | undefined,
  _storeName?: string,
) {
  return shouldShowSarvahHomesUnderSarvah(workspace);
}

export function pickSarvahHomesShmpStores(stores: StoreProfile[]) {
  return (stores || []).filter(isSarvahHomesStore);
}

/** Append SHMP Sarvah Homes (if assigned) without duplicating by id. */
export function withSarvahHomesShmpStores(
  classicStores: StoreProfile[],
  shmpStores: StoreProfile[],
): StoreProfile[] {
  const merged = [...(classicStores || [])];
  const seen = new Set(
    merged.map((store) => String(store._id || "").trim()).filter(Boolean),
  );
  for (const store of pickSarvahHomesShmpStores(shmpStores)) {
    const id = String(store._id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(store);
  }
  return merged.sort((left, right) =>
    String(left.storeName || left.name || "").localeCompare(
      String(right.storeName || right.name || ""),
      undefined,
      { sensitivity: "base" },
    ),
  );
}

/**
 * Sarvah selling catalogue first; add manufacturing products assigned to
 * Sarvah Homes that are not already in the selling list.
 */
export function mergeSarvahAndAssignedShmpProducts(
  sarvahProducts: Product[],
  assignedShmpProducts: Product[],
): Product[] {
  const byId = new Map<string, Product>();
  for (const product of sarvahProducts || []) {
    const id = String(product?._id || "").trim();
    if (id) byId.set(id, product);
  }
  for (const product of assignedShmpProducts || []) {
    const id = String(product?._id || "").trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, product);
  }
  return [...byId.values()].sort((left, right) =>
    String(left.itemName || left.itemRef || "").localeCompare(
      String(right.itemName || right.itemRef || ""),
      undefined,
      { sensitivity: "base" },
    ),
  );
}

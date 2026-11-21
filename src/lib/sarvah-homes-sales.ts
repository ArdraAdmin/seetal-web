import type { StoreProfile } from "./types";

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
 * Sarvah / STL / SH Lakshmi salesmen must only see their own company
 * catalogues. Never merge SHMP manufacturing stock into those workspaces.
 */
export function shouldMergeSarvahHomesInventory(
  _workspace?: string | null | undefined,
  _storeName?: string,
) {
  return false;
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

export type StoreVisibilityRow = {
  key: string;
  storeId: string;
  storeName: string;
  storePrice: string;
  storeItemCode: string;
};

export type StoreProfilePayload = {
  storeId: string;
  storePrice?: number;
  storeItemCode?: string;
  isDisplayed: boolean;
};

type StoreRef = string | { _id?: string; storeName?: string } | undefined;

type StoreProfileSource = {
  store?: StoreRef;
  storePrice?: unknown;
  storeItemCode?: unknown;
  isDisplayed?: boolean;
};

function storeIdOf(store: StoreRef) {
  if (!store) return "";
  if (typeof store === "string") return store;
  return String(store._id ?? "");
}

function storeNameOf(store: StoreRef) {
  if (!store || typeof store === "string") return "";
  return String(store.storeName ?? "");
}

/** Blank when the store uses the base selling price, so the price field stays optional. */
export function storePriceFieldValue(
  storePrice: unknown,
  sellingPrice: unknown,
) {
  if (storePrice == null || storePrice === "") return "";
  const price = Number(storePrice);
  if (!Number.isFinite(price)) return "";
  const base = Number(sellingPrice);
  if (Number.isFinite(base) && price === base) return "";
  return String(price);
}

export function newStoreVisibilityRow(
  storeId: string,
  storeName = "",
): StoreVisibilityRow {
  return {
    key: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId,
    storeName,
    storePrice: "",
    storeItemCode: "",
  };
}

/** Stores the product is currently visible in. Hidden profiles stay off the form. */
export function pricingRowsFromProfiles(
  profiles: StoreProfileSource[] | undefined,
  sellingPrice: unknown,
): StoreVisibilityRow[] {
  return (profiles || [])
    .filter((row) => row.isDisplayed !== false)
    .map((row, index) => ({
      key: `existing-${storeIdOf(row.store) || index}`,
      storeId: storeIdOf(row.store),
      storeName: storeNameOf(row.store),
      storePrice: storePriceFieldValue(row.storePrice, sellingPrice),
      storeItemCode: String(row.storeItemCode ?? ""),
    }));
}

export function storeProfilesFromRows(
  rows: StoreVisibilityRow[],
): { ok: true; profiles: StoreProfilePayload[] } | { ok: false; error: string } {
  const profiles: StoreProfilePayload[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.storeId) continue;
    if (seen.has(row.storeId)) {
      return { ok: false, error: "Select each store only once" };
    }
    seen.add(row.storeId);
    const price =
      row.storePrice.trim() === "" ? undefined : Number(row.storePrice);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      return {
        ok: false,
        error: "Store prices must be valid non-negative numbers",
      };
    }
    profiles.push({
      storeId: row.storeId,
      storePrice: price,
      storeItemCode: row.storeItemCode.trim() || undefined,
      isDisplayed: true,
    });
  }
  return { ok: true, profiles };
}

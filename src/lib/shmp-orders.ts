export type ShmpOrderStore = {
  _id?: string;
  storeName?: string;
  uid?: string;
  city?: string;
};

export function orderStoreName(store: unknown) {
  if (!store) return "";
  if (typeof store === "string") return "";
  if (typeof store === "object" && "storeName" in store) {
    return String((store as ShmpOrderStore).storeName || "").trim();
  }
  return "";
}

export function orderStoreUid(store: unknown) {
  if (!store || typeof store !== "object" || !("uid" in store)) return "";
  return String((store as ShmpOrderStore).uid || "").trim();
}

export function orderMatchesQuery(
  order: {
    _id?: string;
    tempOrderInvoiceNo?: string;
    status?: string;
    store?: unknown;
  },
  query: string,
) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const haystack = [
    order.tempOrderInvoiceNo,
    order._id,
    order.status,
    orderStoreName(order.store),
    orderStoreUid(order.store),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

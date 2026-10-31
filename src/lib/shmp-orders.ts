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

export type OrderSection = "pending" | "ready" | "delivered";

export type ShmpOrderDispatch = {
  ordered?: number;
  produced?: number;
  delivered?: number;
  ready?: number;
  section?: OrderSection;
};

export function orderSectionFromQty(input: {
  ordered?: number;
  delivered?: number;
  ready?: number;
}): OrderSection {
  const ordered = Number(input.ordered) || 0;
  const delivered = Number(input.delivered) || 0;
  const ready = Number(input.ready) || 0;
  if (ordered > 0 && delivered >= ordered - 0.0001) return "delivered";
  if (ready > 0.0001) return "ready";
  return "pending";
}

export function orderSection(order: {
  status?: string;
  dispatch?: ShmpOrderDispatch | null;
}): OrderSection {
  const declared = order.dispatch?.section;
  if (
    declared === "pending" ||
    declared === "ready" ||
    declared === "delivered"
  ) {
    return declared;
  }
  if (order.dispatch) return orderSectionFromQty(order.dispatch);
  if (String(order.status || "") === "Delivered") return "delivered";
  return "pending";
}

export function dispatchFromLines(
  lines: Array<{
    ordered?: number;
    produced?: number;
    delivered?: number;
    ready?: number | null;
  }>,
): ShmpOrderDispatch {
  let ordered = 0;
  let produced = 0;
  let delivered = 0;
  let ready = 0;
  for (const line of lines) {
    const orderedQty = Number(line.ordered) || 0;
    const producedQty = Number(line.produced) || 0;
    const deliveredQty = Number(line.delivered) || 0;
    const readyQty =
      line.ready == null
        ? Math.max(0, producedQty - deliveredQty)
        : Math.max(0, Number(line.ready) || 0);
    ordered += orderedQty;
    produced += producedQty;
    delivered += deliveredQty;
    ready += readyQty;
  }
  return {
    ordered,
    produced,
    delivered,
    ready,
    section: orderSectionFromQty({ ordered, delivered, ready }),
  };
}

export function cartonProgressLabel(dispatch?: ShmpOrderDispatch | null) {
  const ordered = Number(dispatch?.ordered) || 0;
  const produced = Number(dispatch?.produced) || 0;
  const ready = Number(dispatch?.ready) || 0;
  const delivered = Number(dispatch?.delivered) || 0;
  return `${produced} packed · ${ready} ready · ${delivered} delivered of ${ordered}`;
}

export type ReadyDeliveryLine = {
  productId: string;
  qty: number;
  name: string;
};

export function readyDeliveryLines(
  lines: Array<{
    product?: { _id?: string; itemName?: string } | string | null;
    ready?: number;
  }>,
): ReadyDeliveryLine[] {
  const result: ReadyDeliveryLine[] = [];
  for (const line of lines) {
    const product = line.product;
    const productId =
      product && typeof product === "object"
        ? String(product._id || "")
        : typeof product === "string"
          ? product
          : "";
    const qty = Number(line.ready) || 0;
    if (!productId || qty <= 0) continue;
    const name =
      product && typeof product === "object" && product.itemName
        ? product.itemName
        : "Item";
    result.push({ productId, qty, name });
  }
  return result;
}

export function companyIdOf(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value) {
    return String((value as { _id?: string })._id || "");
  }
  return "";
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

export type ShmpOrderStore = {
  _id?: string;
  storeName?: string;
  uid?: string;
  city?: string;
};

function isPcsUnit(unit?: string | null) {
  const raw = String(unit || "").trim().toUpperCase();
  return raw === "PCS" || raw === "PC" || raw === "PIECE" || raw === "PIECES";
}

/** Line qty → cartons when unitReq is PCS (ordered / packed / ready / delivered). */
function qtyInCartons(
  qty: number | null | undefined,
  unit?: string | null,
  ratio?: number | null,
) {
  const n = Number(qty) || 0;
  if (!isPcsUnit(unit)) return n;
  const r = Number(ratio) || 0;
  if (!(r > 0)) return n;
  return n / r;
}

function formatCartonQty(qty: number) {
  const n = Number(qty) || 0;
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n - Math.round(n)) < 0.0001) return String(Math.round(n));
  return String(Math.round(n * 100) / 100);
}

/** Colored pill classes for SHMP order lifecycle status text. */
export function orderStatusClass(status?: string | null) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "delivered") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (value === "confirmed") {
    return "bg-sky-100 text-sky-800";
  }
  if (
    value === "ready" ||
    value === "ready to deliver" ||
    value === "ready-to-deliver"
  ) {
    return "bg-violet-100 text-violet-800";
  }
  if (value === "inproduction" || value === "in production") {
    return "bg-indigo-100 text-indigo-800";
  }
  if (value === "pending" || !value) {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-slate-100 text-slate-700";
}

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
    unitReq?: string | null;
    ratio?: number | null;
  }>,
): ShmpOrderDispatch {
  let ordered = 0;
  let produced = 0;
  let delivered = 0;
  let ready = 0;
  for (const line of lines) {
    const unit = line.unitReq;
    const ratio = line.ratio;
    const orderedQty = qtyInCartons(line.ordered, unit, ratio);
    const producedQty = qtyInCartons(line.produced, unit, ratio);
    const deliveredQty = qtyInCartons(line.delivered, unit, ratio);
    const readyQty =
      line.ready == null
        ? Math.max(0, producedQty - deliveredQty)
        : qtyInCartons(line.ready, unit, ratio);
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
  const ordered = formatCartonQty(Number(dispatch?.ordered) || 0);
  const produced = formatCartonQty(Number(dispatch?.produced) || 0);
  const ready = formatCartonQty(Number(dispatch?.ready) || 0);
  const delivered = formatCartonQty(Number(dispatch?.delivered) || 0);
  return `${produced} cartons packed · ${ready} cartons ready · ${delivered} cartons delivered of ${ordered}`;
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

/** Payable amount when set; otherwise subtotal. */
export function orderPayableAmount(order: {
  payableAmount?: number | null;
  totalCost?: number | null;
}) {
  const raw = order.payableAmount ?? order.totalCost ?? 0;
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
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

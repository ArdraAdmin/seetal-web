import type {
  PendingOrder,
  WarehouseCheckLine,
  WarehouseCheckOrder,
  WarehouseCheckStep,
} from "./types";

export const CHECK_LABELS: Record<WarehouseCheckStep, string> = {
  1: "First Check",
  2: "Double Check",
  3: "Loading Check",
};

export function parseCheckStep(value: string | null): WarehouseCheckStep {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

/** Open the check that matches the order status shown on the list. */
export function warehouseOpenStep(order: {
  firstCheck?: boolean;
  doubleCheck?: boolean;
  loadCheck?: boolean;
}): WarehouseCheckStep {
  if (order.loadCheck) return 3;
  if (order.doubleCheck) return 2;
  return 1;
}

export function warehouseBasePath(pathname: string) {
  return pathname.startsWith("/admin") ? "/admin/warehouse" : "/warehouse";
}

export function warehouseLineProductId(line: WarehouseCheckLine) {
  if (typeof line.product === "string") return line.product;
  return line.product?._id || "";
}

export function cartonLabel(line: WarehouseCheckLine) {
  const ids = Array.isArray(line.cartonId) ? line.cartonId.filter((n) => n != null) : [];
  if (ids.length >= 2) return `Carton #${ids[0]} - ${ids[1]}`;
  if (ids.length === 1) return `Carton #${ids[0]}`;
  return "";
}

export function checkFlagForStep(step: WarehouseCheckStep): "firstCheck" | "doubleCheck" | "loadCheck" {
  if (step === 2) return "doubleCheck";
  if (step === 3) return "loadCheck";
  return "firstCheck";
}

export function warehouseLineName(line: WarehouseCheckLine) {
  if (line.product && typeof line.product === "object") {
    return line.product.itemName || line.product.itemRef || "Product";
  }
  return "Product";
}

export function warehouseLineRef(line: WarehouseCheckLine) {
  if (line.product && typeof line.product === "object") {
    return line.product.itemRef || "";
  }
  return "";
}

export function warehouseLineUnit(line: WarehouseCheckLine) {
  if (line.product && typeof line.product === "object") {
    return line.product.unit || "PCS";
  }
  return "PCS";
}

export function warehouseLineRatio(line: WarehouseCheckLine) {
  if (line.product && typeof line.product === "object") {
    return Number(line.product.ratio) || 0;
  }
  return 0;
}

export function lineIsChecked(line: WarehouseCheckLine, step: WarehouseCheckStep) {
  if (step === 2) return Boolean(line.doubleCheck);
  if (step === 3) return Boolean(line.loadCheck);
  return Boolean(line.firstCheck);
}

/** Zero-quantity lines on double check count as checked. Other lines need the checkbox. */
export function lineReadyToConfirm(line: WarehouseCheckLine, step: WarehouseCheckStep) {
  if (step === 2 && Number(line.quantityAv) === 0) return true;
  return lineIsChecked(line, step);
}

export function sortZeroQuantityFirst(lines: WarehouseCheckLine[]) {
  return [...lines].sort((a, b) => {
    const aZero = Number(a.quantityAv) === 0 ? 0 : 1;
    const bZero = Number(b.quantityAv) === 0 ? 0 : 1;
    return aZero - bZero;
  });
}

export function pendingCheckRank(order: {
  doubleCheck?: boolean;
  firstCheck?: boolean;
  loadCheck?: boolean;
}) {
  if (order.loadCheck) return 3;
  if (order.doubleCheck) return 2;
  if (order.firstCheck) return 1;
  return 0;
}

/** Pending page order: pending, then first check, then double check. */
export function sortPendingWarehouseOrders<T extends { loadCheck?: boolean; doubleCheck?: boolean; firstCheck?: boolean }>(
  orders: T[],
) {
  return orders
    .filter((order) => !order.loadCheck)
    .sort((a, b) => pendingCheckRank(a) - pendingCheckRank(b));
}

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Start of the current Dubai calendar day. */
export function dubaiDayStart(now = Date.now()) {
  const dubaiNow = new Date(now + DUBAI_OFFSET_MS);
  return new Date(
    Date.UTC(
      dubaiNow.getUTCFullYear(),
      dubaiNow.getUTCMonth(),
      dubaiNow.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - DUBAI_OFFSET_MS,
  );
}

/** Warehouse "today" is the coming Dubai calendar day. */
export function warehouseWorkDayRange(now = Date.now()) {
  const dubaiNow = new Date(now + DUBAI_OFFSET_MS);
  const y = dubaiNow.getUTCFullYear();
  const m = dubaiNow.getUTCMonth();
  const d = dubaiNow.getUTCDate() + 1;
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - DUBAI_OFFSET_MS),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - DUBAI_OFFSET_MS),
  };
}

export function invoiceLabel(order: PendingOrder | WarehouseCheckOrder) {
  if (order.tempOrderInvoiceNo) return String(order.tempOrderInvoiceNo);
  if ("invoiceNumber" in order && order.invoiceNumber) {
    return String(order.invoiceNumber);
  }
  return "";
}

export function storeId(order: PendingOrder | WarehouseCheckOrder) {
  if (order.store && typeof order.store === "object" && order.store._id) {
    return String(order.store._id);
  }
  if (typeof order.store === "string") return order.store;
  return "";
}

export function storeTitle(order: PendingOrder | WarehouseCheckOrder) {
  if (order.store && typeof order.store === "object") {
    return order.store.storeName || order.store.name || "";
  }
  if ("storeName" in order && order.storeName) return String(order.storeName);
  if (typeof order.store === "string" && order.store) return order.store;
  return "Store";
}

export function storeMarks(order: PendingOrder | WarehouseCheckOrder) {
  if (order.store && typeof order.store === "object" && order.store.marks) {
    return String(order.store.marks).trim();
  }
  return "";
}

export function storeDescription(order: PendingOrder) {
  const store = typeof order.store === "object" ? order.store : undefined;
  const city = store?.city || order.city;
  const country = store?.country || order.country;
  if ((order.isTempStore || !store) && city && country) {
    return `${city}, ${country}`;
  }
  return store?.alias || "";
}

export function assigneeLabel(order: PendingOrder | WarehouseCheckOrder) {
  const assignee = order.assignee;
  if (typeof assignee === "object" && assignee && "name" in assignee) {
    return assignee.name || "N/A";
  }
  if (typeof assignee === "string" && assignee.trim()) return assignee;
  return "N/A";
}

export function formatOrderDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }
  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function orderDateInputValue(value?: string) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

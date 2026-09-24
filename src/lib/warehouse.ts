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

export function invoiceLabel(order: PendingOrder | WarehouseCheckOrder) {
  if (order.tempOrderInvoiceNo) return String(order.tempOrderInvoiceNo);
  if ("invoiceNumber" in order && order.invoiceNumber) {
    return String(order.invoiceNumber);
  }
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

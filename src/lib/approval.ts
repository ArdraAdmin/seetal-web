import type { ApprovalLineItem, ApprovalOrder } from "./types";

export function approvalInvoice(order: ApprovalOrder) {
  return order.tempOrderInvoiceNo || order._id.slice(-8);
}

export function approvalStoreName(order: ApprovalOrder) {
  if (order.store && typeof order.store === "object") {
    const name = order.store.storeName || order.store.name;
    if (name) return name;
  }
  return order.isTempStore ? "Temporary store" : "Store";
}

export function approvalSalesName(order: ApprovalOrder) {
  if (order.sales && typeof order.sales === "object") {
    return order.sales.name || "";
  }
  return "";
}

export function approvalStatusLabel(status?: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "pending":
      return "Waiting for approval";
    default:
      return "Waiting for approval";
  }
}

export function approvalRejectNote(order: ApprovalOrder) {
  const note = String(order.rejectNote ?? "").trim();
  return note;
}

export function salesQueueStatus(order: ApprovalOrder) {
  const approval = String(order.approvalStatus || "");
  if (approval === "rejected" || order.status === "Rejected") return "rejected";
  if (approval === "pending") return "pending";
  if (approval === "approved") return "approved";
  if (order.isDraft) return "draft";
  return "none";
}

export function salesQueueStatusLabel(order: ApprovalOrder) {
  switch (salesQueueStatus(order)) {
    case "rejected":
      return "Rejected";
    case "pending":
      return "Waiting for admin";
    case "approved":
      return "Approved";
    case "draft":
      return "Draft";
    default:
      return String(order.status || "Pending");
  }
}

export function approvalMoney(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? 0)) || 0;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function approvalPayable(order: ApprovalOrder) {
  return order.payableAmount ?? order.totalCost ?? 0;
}

export function computedPayable(
  totalCost: number,
  discount: number,
  isVat: boolean,
) {
  let amount = totalCost - (totalCost / 100) * discount;
  if (isVat) amount += amount * 0.05;
  return amount;
}

export function lineProductName(line: ApprovalLineItem) {
  if (line.product && typeof line.product === "object") {
    return (
      line.product.itemName ||
      line.product.itemRef ||
      "Product"
    );
  }
  return "Product";
}

export function lineProductId(line: ApprovalLineItem) {
  if (typeof line.product === "string") return line.product;
  return line.product?._id || "";
}

export function storeIdFromOrder(order: ApprovalOrder) {
  if (typeof order.store === "string") return order.store;
  return order.store?._id || "";
}

export function salesIdFromOrder(order: ApprovalOrder) {
  if (typeof order.sales === "string") return order.sales;
  return order.sales?._id || "";
}

function asId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  return String(value);
}

export function resubmitTempOrderPayload(
  order: ApprovalOrder,
  {
    salesId,
    discount,
    payableAmount,
    payableEdited,
    needsApproval,
    note,
  }: {
    salesId: string;
    discount: number;
    payableAmount: number;
    payableEdited: boolean;
    needsApproval: boolean;
    note: string;
  },
) {
  const invoiceType =
    order.invoiceType === "exports" || order.invoiceType === "supermarkets"
      ? order.invoiceType
      : "ld";
  return {
    invoiceType,
    salesId: salesId || salesIdFromOrder(order),
    storeId: storeIdFromOrder(order),
    productDetails: (order.productDetails || []).map((line) => ({
      product: lineProductId(line),
      categoryId: asId(line.categoryId),
      storeCost: Number(line.storeCost) || 0,
      aggregateCost: Number(line.aggregateCost) || 0,
      quantityReq: Number(line.quantityReq) || 0,
      quantityAv: Number(line.quantityAv) || 0,
      unitReq: String(line.unitReq || "CARTONS"),
      unitAv: String(line.unitAv || line.unitReq || "CARTONS"),
      isChecked: Boolean(line.isChecked),
    })),
    categoryList: (order.categoryList || []).map((item) => ({
      masterCategoryId: asId(item.masterCategoryId),
      isDone: Boolean(item.isDone),
    })),
    note: note.trim() || "No note",
    discount,
    isVat: Boolean(order.isVat),
    totalQuantity: Number(order.totalQuantity) || 0,
    totalCost: Number(order.totalCost) || 0,
    date: order.date || order.createdAt || new Date().toISOString(),
    isTempStore: String(Boolean(order.isTempStore)),
    editFlag: "true",
    tempOrderId: order._id,
    payableAmount,
    payableEdited,
    needsApproval,
    ...(invoiceType === "exports" && order.billOfEntry != null
      ? { billOfEntry: Number(order.billOfEntry) || 0 }
      : {}),
  };
}

export function apiMessage(result: unknown, fallback: string) {
  if (typeof result === "string" && result.trim()) {
    return result.replace(/"/g, "");
  }
  return fallback;
}

import type {
  GrvLine,
  GrvLineProduct,
  GrvOrder,
  PaymentRecord,
  PdcRecord,
  PendingOrder,
} from "./types";
import { roundMoney, salesMoney } from "./sales";

export const GRV_NOTE_PREFIX = "GRV ";
export const PAYMENT_CURRENCY = "AED";

export function invoiceNumberOf(order: {
  invoiceNumber?: string;
  tempOrderInvoiceNo?: string;
  _id: string;
}) {
  return order.invoiceNumber || order.tempOrderInvoiceNo || order._id.slice(-8);
}

export function invoiceStoreName(order: {
  storeName?: string;
  store?: string | { storeName?: string; name?: string };
  isTempStore?: boolean;
}) {
  if (order.storeName) return order.storeName;
  if (order.store && typeof order.store === "object") {
    return order.store.storeName || order.store.name || "Store";
  }
  return order.isTempStore ? "Temporary store" : "Store";
}

export function invoiceTotal(order: {
  totalCost?: unknown;
  totalAmount?: unknown;
  payableAmount?: unknown;
}) {
  const value = order.totalCost ?? order.totalAmount ?? order.payableAmount ?? 0;
  return Number(value) || 0;
}

export function invoiceDateOf(order: { date?: string; createdAt?: string }) {
  return order.date || order.createdAt || "";
}

export function formatInvoiceDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function daysAgo(days: number) {
  const date = startOfLocalDay(new Date());
  date.setDate(date.getDate() - days);
  return date;
}

export function exportRangeBounds(days: number | null) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (days == null) {
    return {
      startDate: new Date(2000, 0, 1).toISOString(),
      endDate: end.toISOString(),
    };
  }
  return {
    startDate: daysAgo(days).toISOString(),
    endDate: end.toISOString(),
  };
}

export function isWithinDays(value: string | undefined, days: number | null) {
  if (days == null) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return startOfLocalDay(date) >= daysAgo(days);
}

export function lineProduct(line: GrvLine): GrvLineProduct | null {
  if (line.product && typeof line.product === "object") return line.product;
  return null;
}

export function lineProductId(line: GrvLine) {
  if (typeof line.product === "string") return line.product;
  return line.product?._id || "";
}

export function lineProductName(line: GrvLine) {
  const product = lineProduct(line);
  return product?.itemName || product?.itemRef || "Product";
}

export function lineRatio(line: GrvLine) {
  return Number(lineProduct(line)?.ratio) || 1;
}

export function lineUnit(line: GrvLine) {
  return lineProduct(line)?.unit || line.unitAv || "PCS";
}

export function toPieces(qty: number, unit: string, ratio: number) {
  if (String(unit).toUpperCase() === "CARTONS") {
    return (Number(qty) || 0) * (Number(ratio) || 1);
  }
  return Number(qty) || 0;
}

export function lineAmount(qty: number, unit: string, storeCost: number, ratio: number) {
  const cost = Number(storeCost) || 0;
  if (String(unit).toUpperCase() === "CARTONS") {
    return roundMoney(cost * (Number(qty) || 0) * (Number(ratio) || 1));
  }
  return roundMoney(cost * (Number(qty) || 0));
}

export function lineGrvQty(line: GrvLine) {
  return Number(line.grv?.grvQty) || 0;
}

export function lineGrvUnit(line: GrvLine) {
  return line.grv?.grvUnit || line.unitAv || "PCS";
}

export function lineIsReturned(line: GrvLine) {
  return Boolean(line.grv?.isGRV) || lineGrvQty(line) > 0;
}

export function lineIsDamaged(line: GrvLine) {
  return Boolean(line.isDamaged || line.damaged?.isDamaged);
}

export function lineGrvAmount(line: GrvLine) {
  if (!lineIsReturned(line)) return 0;
  return lineAmount(
    lineGrvQty(line),
    lineGrvUnit(line),
    Number(line.storeCost) || 0,
    lineRatio(line),
  );
}

export function orderGrvAmount(order: { productDetails?: GrvLine[] }) {
  return roundMoney(
    (order.productDetails || []).reduce((sum, line) => sum + lineGrvAmount(line), 0),
  );
}

export function productPieces(product: {
  inQty?: { amountInCartons?: number; amountInUnits?: number };
  ratio?: number;
}) {
  const ratio = Number(product.ratio) || 1;
  const cartons = Number(product.inQty?.amountInCartons) || 0;
  const units = Number(product.inQty?.amountInUnits) || 0;
  return cartons * ratio + units;
}

export function paymentOrderId(payment: PaymentRecord) {
  if (typeof payment.order === "string") return payment.order;
  return payment.order?._id || "";
}

export function pdcOrderId(pdc: PdcRecord) {
  if (typeof pdc.order === "string") return pdc.order;
  return pdc.order?._id || "";
}

export function isGrvPayment(payment: PaymentRecord) {
  return String(payment.note || "").startsWith(GRV_NOTE_PREFIX);
}

export function receivedAmount(payments: PaymentRecord[]) {
  return roundMoney(
    payments.reduce((sum, payment) => {
      if (isGrvPayment(payment)) return sum;
      return sum + (Number(payment.amountPaid) || 0);
    }, 0),
  );
}

export function collectableAmount(order: { totalCost?: unknown; totalAmount?: unknown; productDetails?: GrvLine[] }) {
  return roundMoney(Math.max(0, invoiceTotal(order) - orderGrvAmount(order)));
}

export function remainingAmount(
  order: { totalCost?: unknown; totalAmount?: unknown; productDetails?: GrvLine[] },
  payments: PaymentRecord[],
) {
  return roundMoney(Math.max(0, collectableAmount(order) - receivedAmount(payments)));
}

export function latestPdc(pdcs: PdcRecord[]) {
  if (pdcs.length === 0) return null;
  return [...pdcs].sort((a, b) => {
    const aTime = new Date(a.chequeDate || 0).getTime();
    const bTime = new Date(b.chequeDate || 0).getTime();
    return bTime - aTime;
  })[0];
}

export function pdcChequeDay(pdc: PdcRecord | null) {
  if (!pdc?.chequeDate) return null;
  const date = new Date(pdc.chequeDate);
  if (Number.isNaN(date.getTime())) return null;
  return startOfLocalDay(date);
}

export function isPdcPending(pdc: PdcRecord | null) {
  const cheque = pdcChequeDay(pdc);
  if (!cheque) return false;
  return cheque > startOfLocalDay(new Date());
}

export function isPdcDue(pdc: PdcRecord | null) {
  const cheque = pdcChequeDay(pdc);
  if (!cheque) return false;
  return cheque <= startOfLocalDay(new Date());
}

export function grvRemarkNote(amount: number) {
  return `${GRV_NOTE_PREFIX}${salesMoney(amount)} will not be collected`;
}

export function asInvoiceOrder(order: PendingOrder): GrvOrder {
  return order as GrvOrder;
}

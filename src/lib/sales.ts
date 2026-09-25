import type { Product, SalesCartLine, StoreProfile } from "./types";

export function salesMoney(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function roundMoney(value: number) {
  return Number((Number(value) || 0).toFixed(2));
}

export function productUnitPrice(product: Product) {
  const store = Number(product.currentStorePrice);
  if (Number.isFinite(store) && store > 0) return store;
  return Number(product.sellingPrice) || 0;
}

export function productUnit(product: Product) {
  return product.unit || "PCS";
}

export function productRatio(product: Product) {
  return Number(product.ratio) || 0;
}

export function productCartonStock(product: Product) {
  const value = product.inQty?.amountInCartons ?? product.amountInCartons ?? 0;
  return Math.max(0, Number(value) || 0);
}

export function productUnitStock(product: Product) {
  const value = product.inQty?.amountInUnits ?? product.amountInUnits ?? 0;
  return Math.max(0, Number(value) || 0);
}

export function productCategoryId(product: Product) {
  if (typeof product.category === "object" && product.category?._id) {
    return String(product.category._id);
  }
  if (typeof product.category === "string" && product.category) {
    return product.category;
  }
  return String(product.categoryId || product.subCategoryId || "");
}

export function productMasterCategoryId(product: Product) {
  if (product.masterCategoryId) return String(product.masterCategoryId);
  if (
    typeof product.category === "object" &&
    product.category?.masterCategoryId
  ) {
    return String(product.category.masterCategoryId);
  }
  return "";
}

export function lineAggregate(line: Pick<SalesCartLine, "storeCost" | "quantityReq" | "unitReq" | "ratio">) {
  const qty = Number(line.quantityReq) || 0;
  const cost = Number(line.storeCost) || 0;
  const ratio = Number(line.ratio) || 0;
  const amount =
    String(line.unitReq).toUpperCase() === "CARTONS" ? cost * qty * ratio : cost * qty;
  return roundMoney(amount);
}

export function lineUnitQty(line: Pick<SalesCartLine, "quantityReq" | "unitReq" | "ratio">) {
  const qty = Number(line.quantityReq) || 0;
  if (String(line.unitReq).toUpperCase() === "CARTONS") {
    return qty * (Number(line.ratio) || 0);
  }
  return qty;
}

export function cartTotals(lines: SalesCartLine[]) {
  const totalCost = roundMoney(lines.reduce((sum, line) => sum + lineAggregate(line), 0));
  const totalQuantity = lines.reduce((sum, line) => sum + lineUnitQty(line), 0);
  return { totalCost, totalQuantity };
}

export function computedPayable(totalCost: number, discount: number, isVat = true) {
  let amount = totalCost - (totalCost / 100) * discount;
  if (isVat) amount += amount * 0.05;
  return roundMoney(amount);
}

export function storeTitle(store: StoreProfile) {
  return store.storeName || store.name || "Store";
}

export function storeMarks(store: StoreProfile) {
  return String(store.marks || "").trim();
}

export function storeLocation(store: StoreProfile) {
  const city = String(store.city || "").trim();
  const country = String(store.country || "").trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || String(store.alias || "").trim();
}

export function storeSalesmanId(store: StoreProfile) {
  const salesman = store.salesman;
  if (typeof salesman === "string") return salesman;
  if (salesman && typeof salesman === "object") return salesman._id || "";
  return "";
}

export function asStoreList(data: unknown): StoreProfile[] {
  if (Array.isArray(data)) return data as StoreProfile[];
  return [];
}

export function asProductList(data: unknown): Product[] {
  if (Array.isArray(data)) return data as Product[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["products", "productArr", "product", "data", "items"]) {
      if (Array.isArray(o[key])) return o[key] as Product[];
    }
  }
  return [];
}

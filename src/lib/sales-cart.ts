import type { Product, SalesCartLine } from "./types";
import {
  productCategoryId,
  productMasterCategoryId,
  productRatio,
  productUnit,
  productUnitPrice,
} from "./sales";

const PREFIX = "stl_sales_cart_";
const CATALOG_KEY = "stl_sales_catalog";
const EVENT = "stl-sales-cart";

function key(storeId: string) {
  return `${PREFIX}${storeId}`;
}

export function loadCart(storeId: string): SalesCartLine[] {
  if (typeof window === "undefined" || !storeId) return [];
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SalesCartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(storeId: string, lines: SalesCartLine[]) {
  if (typeof window === "undefined" || !storeId) return;
  localStorage.setItem(key(storeId), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { storeId } }));
}

export function clearCart(storeId: string) {
  saveCart(storeId, []);
}

export function cartCount(storeId: string) {
  return loadCart(storeId).reduce((sum, line) => sum + (Number(line.quantityReq) || 0), 0);
}

export function upsertCartLine(storeId: string, line: SalesCartLine) {
  const lines = loadCart(storeId).filter((item) => item.productId !== line.productId);
  if (line.quantityReq > 0) lines.push(line);
  saveCart(storeId, lines);
  return lines;
}

export function cartLineFromProduct(
  product: Product,
  quantity: number,
  unitReq: string,
): SalesCartLine | null {
  const productId = product._id;
  const categoryId = productCategoryId(product);
  const masterCategoryId = productMasterCategoryId(product);
  if (!productId || !categoryId) return null;
  return {
    productId,
    itemName: product.itemName || product.itemRef || "Product",
    itemRef: product.itemRef || "",
    unit: productUnit(product),
    ratio: productRatio(product),
    storeCost: productUnitPrice(product),
    quantityReq: quantity,
    unitReq,
    categoryId,
    masterCategoryId,
  };
}

export function loadCatalog(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Product[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCatalog(products: Product[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CATALOG_KEY, JSON.stringify(products));
}

export function onCartChange(storeId: string, callback: () => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ storeId?: string }>).detail;
    if (!detail?.storeId || detail.storeId === storeId) callback();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

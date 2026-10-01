import type { Product } from "./types";
import { companyIds, stlCompanyId } from "./profiles";

export interface SalesCompanyAccess {
  companyIds: string[];
  companyNames: string[];
  includeUnassigned: boolean;
}

function normalizeCompanyName(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

const ACCESS_KEY = "stl_sales_company_access";
const CATALOG_KEY = "stl_sales_product_catalog";
const STORES_KEY = "stl_sales_downloaded_stores";
const ALLOWED_IDS_KEY = "stl_sales_allowed_product_ids";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onSalesAccessChange(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function loadSalesCompanyAccess(): SalesCompanyAccess {
  if (typeof window === "undefined") {
    return { companyIds: [], companyNames: ["STL"], includeUnassigned: false };
  }
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return { companyIds: [], companyNames: ["STL"], includeUnassigned: false };
    const parsed = JSON.parse(raw) as SalesCompanyAccess;
    const names = Array.isArray(parsed.companyNames)
      ? parsed.companyNames.map((name) => String(name || "").trim()).filter(Boolean)
      : [];
    return {
      companyIds: Array.isArray(parsed.companyIds)
        ? parsed.companyIds.map(String).filter(Boolean)
        : [],
      companyNames: names,
      includeUnassigned: false,
    };
  } catch {
    return { companyIds: [], companyNames: ["STL"], includeUnassigned: false };
  }
}

function writeSalesCompanyAccess(access: SalesCompanyAccess) {
  if (typeof window === "undefined") return false;
  const previous = loadSalesCompanyAccess();
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  return accessKey(previous) !== accessKey(access);
}

export function saveSalesCompanyAccess(access: SalesCompanyAccess) {
  if (writeSalesCompanyAccess(access)) notify();
}

export function resolveCatalogAccess(
  assigned: string[],
  companies: { _id: string; name?: string }[],
): SalesCompanyAccess {
  const assignedIds = assigned.map(String).filter(Boolean);
  if (assignedIds.length > 0) {
    const names = companies
      .filter((company) => assignedIds.includes(String(company._id)))
      .map((company) => String(company.name || "").trim())
      .filter(Boolean);
    return {
      companyIds: assignedIds,
      companyNames: names,
      includeUnassigned: false,
    };
  }
  const stl = companies.find(
    (company) => String(company.name || "").trim() === "STL",
  );
  return {
    companyIds: stl?._id ? [String(stl._id)] : [],
    companyNames: ["STL"],
    includeUnassigned: false,
  };
}

export function accessKey(access: SalesCompanyAccess) {
  return `${[...access.companyIds].sort().join(",")}:${[...allowedCompanyNames(access)].sort().join(",")}`;
}

export function allowedCompanyNames(access: SalesCompanyAccess) {
  return (access.companyNames || [])
    .map((name) => normalizeCompanyName(name))
    .filter(Boolean);
}

export function productCompanyName(product: Product) {
  const raw = product.company;
  if (raw && typeof raw === "object") {
    return normalizeCompanyName(raw.name);
  }
  return "";
}

export function productCompanyId(product: Product) {
  const raw = product.company;
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") return raw;
  return String(raw._id || "");
}

export function isProductAllowed(product: Product, access: SalesCompanyAccess) {
  const allowedNames = allowedCompanyNames(access);
  const id = productCompanyId(product);
  const name = productCompanyName(product);
  if (id) {
    if (access.companyIds.includes(id)) return true;
    if (name && allowedNames.includes(name)) return true;
    return false;
  }
  if (name) return allowedNames.includes(name);
  if (loadAllowedProductIds(access)?.has(product._id)) return true;
  return false;
}

export function filterAllowedProducts(
  products: Product[],
  access: SalesCompanyAccess,
) {
  const allowedIds = new Set(access.companyIds);
  const allowedNames = allowedCompanyNames(access);
  const extraIds = loadAllowedProductIds(access);
  const filtered: Product[] = [];
  for (const product of products) {
    const id = productCompanyId(product);
    const name = productCompanyName(product);
    if (id) {
      if (allowedIds.has(id) || (name && allowedNames.includes(name))) {
        filtered.push(product);
      }
      continue;
    }
    if (name) {
      if (allowedNames.includes(name)) filtered.push(product);
      continue;
    }
    if (extraIds?.has(product._id)) filtered.push(product);
  }
  return filtered;
}

export function companyQueryPayload(access: SalesCompanyAccess) {
  return {
    companyIds: access.companyIds,
    includeUnassigned: access.includeUnassigned,
  };
}

export function defaultSalesCompanyAccess(
  stlId: string,
): SalesCompanyAccess {
  return {
    companyIds: stlId ? [stlId] : [],
    companyNames: ["STL"],
    includeUnassigned: false,
  };
}

let memoryCatalog: { accessKey: string; products: Product[] } | null = null;
let filteredCatalog: { key: string; products: Product[] } | null = null;
let allowedIdsCache: { key: string; ids: Set<string> | null } | null = null;

function slimSalesProduct(product: Product): Product {
  const category = product.category;
  let slimCategory: Product["category"] = category;
  if (category && typeof category === "object") {
    const record = category as {
      _id?: string;
      subCategory?: string;
      masterCategory?: string;
      masterCategoryId?: string;
      masterCategoryName?: string;
    };
    slimCategory = {
      _id: record._id,
      subCategory: record.subCategory,
      masterCategory: record.masterCategory,
      masterCategoryId: record.masterCategoryId,
    };
    if (record.masterCategoryName) {
      (slimCategory as { masterCategoryName?: string }).masterCategoryName =
        record.masterCategoryName;
    }
  }
  const company = product.company;
  const slimCompany: Product["company"] =
    company && typeof company === "object"
      ? { _id: company._id, name: company.name, prefix: company.prefix }
      : company;
  const inQty = product.inQty;
  return {
    _id: product._id,
    itemRef: product.itemRef,
    itemName: product.itemName,
    barCode: product.barCode,
    barcode: product.barcode,
    unit: product.unit,
    ratio: product.ratio,
    sellingPrice: product.sellingPrice,
    currentStorePrice: product.currentStorePrice,
    isDisplay: product.isDisplay,
    inQty: inQty
      ? {
          amountInCartons: inQty.amountInCartons,
          amountInUnits: inQty.amountInUnits,
        }
      : undefined,
    amountInCartons: product.amountInCartons,
    amountInUnits: product.amountInUnits,
    category: slimCategory,
    categoryId: product.categoryId,
    subCategoryId: product.subCategoryId,
    masterCategoryId: product.masterCategoryId,
    masterCategoryName:
      typeof product.masterCategoryName === "string"
        ? product.masterCategoryName
        : undefined,
    company: slimCompany,
  };
}

function scheduleSlimPersist(
  entry: { accessKey: string; products: Product[] },
  rawLength: number,
) {
  const payload = JSON.stringify(entry);
  if (payload.length >= rawLength * 0.9) return;
  const write = () => {
    if (
      memoryCatalog?.accessKey !== entry.accessKey ||
      memoryCatalog.products !== entry.products
    ) {
      return;
    }
    try {
      localStorage.setItem(CATALOG_KEY, payload);
    } catch {
      /* Keep the previous copy if the slim one cannot be stored. */
    }
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(write);
  else setTimeout(write, 200);
}

export function dropSalesCatalogCache() {
  memoryCatalog = null;
  filteredCatalog = null;
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CATALOG_KEY);
  } catch {
    /* ignore */
  }
}

export function loadCachedCatalog(): { accessKey: string; products: Product[] } | null {
  if (memoryCatalog) return memoryCatalog;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessKey?: string; products?: Product[] };
    if (!Array.isArray(parsed.products)) return null;
    memoryCatalog = {
      accessKey: String(parsed.accessKey || ""),
      products: parsed.products.map(slimSalesProduct),
    };
    if (memoryCatalog.products.length > 0) {
      scheduleSlimPersist(memoryCatalog, raw.length);
    }
    return memoryCatalog;
  } catch {
    return null;
  }
}

export function saveCachedCatalog(access: SalesCompanyAccess, products: Product[]) {
  if (typeof window === "undefined") return;
  memoryCatalog = {
    accessKey: accessKey(access),
    products: products.map(slimSalesProduct),
  };
  filteredCatalog = null;
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(memoryCatalog));
  } catch {
    try {
      localStorage.removeItem(CATALOG_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function saveAllowedProductIds(
  access: SalesCompanyAccess,
  ids: string[],
) {
  const unique = [...new Set(ids.filter(Boolean))];
  allowedIdsCache = { key: accessKey(access), ids: new Set(unique) };
  if (typeof window === "undefined") return;
  localStorage.setItem(
    ALLOWED_IDS_KEY,
    JSON.stringify({
      accessKey: accessKey(access),
      ids: unique,
    }),
  );
}

export function loadAllowedProductIds(
  access: SalesCompanyAccess,
): Set<string> | null {
  const key = accessKey(access);
  if (allowedIdsCache?.key === key) return allowedIdsCache.ids;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ALLOWED_IDS_KEY);
    if (!raw) {
      allowedIdsCache = { key, ids: null };
      return null;
    }
    const parsed = JSON.parse(raw) as { accessKey?: string; ids?: string[] };
    if (parsed.accessKey !== key || !Array.isArray(parsed.ids)) {
      allowedIdsCache = { key, ids: null };
      return null;
    }
    const ids = new Set(parsed.ids.map(String).filter(Boolean));
    allowedIdsCache = { key, ids };
    return ids;
  } catch {
    return null;
  }
}

export function catalogForAccess(access: SalesCompanyAccess): Product[] | null {
  const key = accessKey(access);
  if (filteredCatalog?.key === key) {
    return filteredCatalog.products.length > 0 ? filteredCatalog.products : null;
  }
  const cached = loadCachedCatalog();
  if (!cached || cached.accessKey !== key || cached.products.length === 0) return null;
  const allowed = filterAllowedProducts(cached.products, access);
  if (allowed.length === 0) return null;
  filteredCatalog = { key, products: allowed };
  return allowed;
}

export function replaceCachedCatalog(
  access: SalesCompanyAccess,
  products: Product[],
) {
  saveCachedCatalog(access, filterAllowedProducts(products, access));
  writeSalesCompanyAccess(access);
  notify();
}

export type DownloadedStore = {
  _id: string;
  storeName?: string;
  name?: string;
  marks?: string;
  city?: string;
  country?: string;
  salesPerson?: unknown;
  isTemp?: boolean;
  isTempStore?: boolean;
  [key: string]: unknown;
};

export function loadDownloadedStores(): DownloadedStore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadedStore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDownloadedStores(stores: DownloadedStore[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORES_KEY, JSON.stringify(stores));
}

export { companyIds, stlCompanyId };

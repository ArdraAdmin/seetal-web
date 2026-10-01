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

export function saveSalesCompanyAccess(access: SalesCompanyAccess) {
  if (typeof window === "undefined") return;
  const previous = loadSalesCompanyAccess();
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  if (accessKey(previous) !== accessKey(access)) notify();
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
  return products.filter((product) => isProductAllowed(product, access));
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

export function loadCachedCatalog(): { accessKey: string; products: Product[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessKey?: string; products?: Product[] };
    if (!Array.isArray(parsed.products)) return null;
    return {
      accessKey: String(parsed.accessKey || ""),
      products: parsed.products,
    };
  } catch {
    return null;
  }
}

export function saveCachedCatalog(access: SalesCompanyAccess, products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CATALOG_KEY,
      JSON.stringify({ accessKey: accessKey(access), products }),
    );
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
  if (typeof window === "undefined") return;
  localStorage.setItem(
    ALLOWED_IDS_KEY,
    JSON.stringify({
      accessKey: accessKey(access),
      ids: [...new Set(ids.filter(Boolean))],
    }),
  );
}

export function loadAllowedProductIds(
  access: SalesCompanyAccess,
): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ALLOWED_IDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessKey?: string; ids?: string[] };
    if (parsed.accessKey !== accessKey(access) || !Array.isArray(parsed.ids)) {
      return null;
    }
    return new Set(parsed.ids.map(String).filter(Boolean));
  } catch {
    return null;
  }
}

export function catalogForAccess(access: SalesCompanyAccess): Product[] | null {
  const cached = loadCachedCatalog();
  if (!cached || cached.accessKey !== accessKey(access)) return null;
  if (!cached.products.length) return null;
  const allowed = filterAllowedProducts(cached.products, access);
  return allowed.length > 0 ? allowed : null;
}

export function replaceCachedCatalog(
  access: SalesCompanyAccess,
  products: Product[],
) {
  saveCachedCatalog(access, filterAllowedProducts(products, access));
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

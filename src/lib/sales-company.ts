import type { Product } from "./types";
import { companyIds, stlCompanyId } from "./profiles";

export interface SalesCompanyAccess {
  companyIds: string[];
  includeUnassigned: boolean;
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
    return { companyIds: [], includeUnassigned: false };
  }
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return { companyIds: [], includeUnassigned: false };
    const parsed = JSON.parse(raw) as SalesCompanyAccess;
    return {
      companyIds: Array.isArray(parsed.companyIds)
        ? parsed.companyIds.map(String).filter(Boolean)
        : [],
      includeUnassigned: Boolean(parsed.includeUnassigned),
    };
  } catch {
    return { companyIds: [], includeUnassigned: false };
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
  stlId: string,
): SalesCompanyAccess {
  const companyIds = assigned.map(String).filter(Boolean);
  if (companyIds.length > 0) {
    return { companyIds, includeUnassigned: false };
  }
  return {
    companyIds: stlId ? [stlId] : [],
    includeUnassigned: false,
  };
}

export function accessKey(access: SalesCompanyAccess) {
  return `${access.includeUnassigned ? "1" : "0"}:${[...access.companyIds].sort().join(",")}`;
}

export function productCompanyId(product: Product) {
  const raw = product.company;
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") return raw;
  return String(raw._id || "");
}

export function isProductAllowed(product: Product, access: SalesCompanyAccess) {
  const id = productCompanyId(product);
  if (id) return access.companyIds.includes(id);
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

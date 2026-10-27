import { getStoredAuth } from "./auth";
import type { ExpiryAlertRow } from "./expiry-window";
import type {
  Driver,
  GrvLine,
  GrvOrder,
  PaymentRecord,
  PdcRecord,
  PendingOrder,
  Product,
  ProfileUser,
  StoreProfile,
  Vehicle,
  VehicleExtras,
  VehicleMaintenance,
  WarehouseCounts,
  WarehouseCheckLine,
  WarehouseCheckOrder,
  WarehouseCheckStep,
  ApprovalOrder,
  AuthUser,
  SalesCartLine,
} from "./types";
import { isObjectId } from "./approval";
import { asProductList, asStoreList, cartTotals, cartUnitPriceEdited, lineAggregate } from "./sales";
import { companyIds, salesField } from "./profiles";
import {
  companyQueryPayload,
  filterAllowedProducts,
  loadSalesCompanyAccess,
  replaceCachedCatalog,
  accessKey,
  catalogForAccess,
  loadAllowedProductIds,
  loadCachedCatalog,
  loadDownloadedStores,
  saveSalesCompanyAccess,
  saveAllowedProductIds,
  resolveCatalogAccess,
  dropSalesCatalogCache,
  type SalesCompanyAccess,
} from "./sales-company";
import {
  isSundayDeliveryEnabled,
  ordersFromWarehousePayload,
  pendingSkipsSunday,
  setSundayDeliveryEnabled,
  sortPendingWarehouseOrders,
  warehouseWorkDayRange,
} from "./warehouse";
import {
  accessFromSelectedCompany,
  isSalesInventoryKey,
  loadSelectedSalesCompany,
  resolveSalesCompanyByKey,
  SALES_COMPANY_LABELS,
  saveSalesWorkspace,
  saveSelectedSalesCompany,
  type SalesCompanyKey,
} from "./sales-selected-company";

const REMOTE_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function apiBase(): string {
  return typeof window === "undefined" ? REMOTE_API_BASE : "/stl-api";
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.err === "string") return o.err;
    if (typeof o.message === "string") return o.message;
  }
  return fallback;
}

async function requestRaw(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<{ body: unknown; headers: Headers; ok: boolean; status: number }> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const user = getStoredAuth();
    if (user?.token) {
      headers.set("Authorization", user.token);
      headers.set("auth-token", user.token);
    }
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...options,
      cache: options.cache ?? "no-store",
      headers,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the STL API. The request was blocked before your credentials were checked.",
      0,
    );
  }

  const body = await parseBody(res);
  return { body, headers: res.headers, ok: res.ok, status: res.status };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const { body, ok, status } = await requestRaw(path, options, auth);
  if (!ok) {
    throw new ApiError(
      errorMessage(body, `Request failed (${status})`),
      status,
    );
  }
  return body as T;
}

async function siteRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      cache: options.cache ?? "no-store",
      headers,
    });
  } catch {
    throw new ApiError("Cannot complete this request.", 0);
  }

  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(
      errorMessage(body, `Request failed (${res.status})`),
      res.status,
    );
  }
  return body as T;
}

let sundayDeliveryLoaded = false;
let sundayDeliveryLoading: Promise<boolean> | null = null;
let sundayDeliveryCanEdit = false;

export function canEditSundayDelivery() {
  return sundayDeliveryCanEdit;
}

export async function loadSundayDeliverySetting(force = false): Promise<boolean> {
  if (sundayDeliveryLoaded && !force) return isSundayDeliveryEnabled();
  if (!force && sundayDeliveryLoading) return sundayDeliveryLoading;
  sundayDeliveryLoading = (async () => {
    try {
      const data = await siteRequest<{
        sundayDelivery?: boolean;
        canEdit?: boolean;
      }>("/api/warehouse/sunday-delivery");
      const enabled = data.sundayDelivery === true;
      setSundayDeliveryEnabled(enabled);
      sundayDeliveryCanEdit = data.canEdit === true;
      sundayDeliveryLoaded = true;
      return enabled;
    } catch {
      setSundayDeliveryEnabled(false);
      sundayDeliveryCanEdit = false;
      sundayDeliveryLoaded = true;
      return false;
    } finally {
      sundayDeliveryLoading = null;
    }
  })();
  return sundayDeliveryLoading;
}

export async function updateSundayDeliverySetting(enabled: boolean) {
  const data = await siteRequest<{ sundayDelivery?: boolean }>(
    "/api/warehouse/sunday-delivery",
    {
      method: "PUT",
      body: JSON.stringify({ sundayDelivery: enabled }),
    },
  );
  const next = data.sundayDelivery === true;
  setSundayDeliveryEnabled(next);
  sundayDeliveryLoaded = true;
  return next;
}

function authUserFromPayload(
  data: Record<string, unknown>,
  fallbackEmail = "",
  tokenOverride?: string,
): AuthUser {
  const field =
    data.field && typeof data.field === "object"
      ? (data.field as Record<string, unknown>)
      : null;
  const adminField =
    field?.admin && typeof field.admin === "object"
      ? (field.admin as Record<string, unknown>)
      : null;

  const environments = Array.isArray(data.environments)
    ? (data.environments as unknown[])
        .map((e) => String(e).toLowerCase())
        .filter((e): e is "stl" | "shmp" => e === "stl" || e === "shmp")
    : undefined;

  const token = String(tokenOverride ?? data.token ?? "");

  return {
    id: String(data._id ?? ""),
    name: String(data.name ?? ""),
    email: String(data.email ?? fallbackEmail),
    role: String(data.role ?? ""),
    token,
    mobileNumber: data.mobileNumber
      ? String(data.mobileNumber)
      : undefined,
    isSuperAdmin: adminField?.isSuperAdmin === true,
    environments:
      environments && environments.length
        ? environments
        : String(data.role) === "Supervisor"
          ? (["shmp"] as ("stl" | "shmp")[])
          : adminField?.isSuperAdmin === true
            ? (["stl", "shmp"] as ("stl" | "shmp")[])
            : (["stl"] as ("stl" | "shmp")[]),
    hrCompanyAccess: Array.isArray(data.hrCompanyAccess)
      ? (data.hrCompanyAccess as AuthUser["hrCompanyAccess"])
      : undefined,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const { body, headers, ok, status } = await requestRaw(
    "/user/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );

  if (!ok) {
    throw new ApiError(
      errorMessage(body, `Request failed (${status})`),
      status,
    );
  }

  const data =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  const token = String(data.token ?? headers.get("auth-token") ?? "");
  if (!token) {
    throw new ApiError("Login succeeded but no token was returned", 400);
  }

  return authUserFromPayload(data, email, token);
}

/** Refresh auth profile (environments, HR ACL) from STLAPI. */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const stored = getStoredAuth();
  if (!stored?.token) {
    throw new ApiError("Not signed in", 401);
  }
  const { body, ok, status } = await requestRaw("/user/me", { method: "GET" });
  if (!ok) {
    throw new ApiError(
      errorMessage(body, `Request failed (${status})`),
      status,
    );
  }
  const data =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  return authUserFromPayload(data, stored.email, stored.token);
}

export const changeOwnPassword = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) =>
  siteRequest<string>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });

// —— Drivers ——
export const getDrivers = () => request<Driver[]>("/admin/driver/read");
export const addDriver = (driverName: string, driverPhoneNo: string) =>
  request<Driver>("/admin/driver/add", {
    method: "POST",
    body: JSON.stringify({ driverName, driverPhoneNo }),
  });
export const editDriver = (
  driverId: string,
  driverName: string,
  driverPhoneNo: string,
) =>
  request<string>("/admin/driver/edit", {
    method: "POST",
    body: JSON.stringify({ driverId, driverName, driverPhoneNo }),
  });
export const deleteDriver = (driverId: string) =>
  request<string>("/admin/driver/delete", {
    method: "POST",
    body: JSON.stringify({ driverId }),
  });

// —— Vehicles ——
export const getVehicles = () => request<Vehicle[]>("/admin/vehicle/read");
export const addVehicle = (vehicleNumber: number) =>
  request<string>("/admin/vehicle/add", {
    method: "POST",
    body: JSON.stringify({ vehicleNumber }),
  });
export const editVehicle = (
  vehicleId: string,
  vehicleNumber: number,
  extras?: VehicleExtras,
) =>
  siteRequest<string>("/api/admin/vehicle/edit", {
    method: "POST",
    body: JSON.stringify({ vehicleId, vehicleNumber, ...extras }),
  });
export const deleteVehicle = (vehicleId: string) =>
  siteRequest<string>("/api/admin/vehicle/delete", {
    method: "POST",
    body: JSON.stringify({ vehicleId }),
  });
export const getVehicleDetails = (vehicleId: string) =>
  siteRequest<{ extras: VehicleExtras; maintenance: VehicleMaintenance[] }>(
    `/api/admin/vehicle/details?vehicleId=${encodeURIComponent(vehicleId)}`,
  );
export const getVehicleExtrasMap = (ids: string[]) => {
  if (ids.length === 0) {
    return Promise.resolve({ extras: {} as Record<string, VehicleExtras> });
  }
  return siteRequest<{ extras: Record<string, VehicleExtras> }>(
    `/api/admin/vehicle/details?ids=${ids.map(encodeURIComponent).join(",")}`,
  );
};
export const getMulkyaAlerts = () =>
  siteRequest<{ vehicles: ExpiryAlertRow[] }>(
    "/api/admin/vehicle/mulkya-alerts",
  );
export const addVehicleMaintenance = (
  vehicleId: string,
  payload: {
    title: string;
    amount: number;
    description: string;
    date: string;
  },
) =>
  siteRequest<VehicleMaintenance>("/api/admin/vehicle/maintenance", {
    method: "POST",
    body: JSON.stringify({ vehicleId, ...payload }),
  });

// —— Stores ——
export const getStores = (page: number) =>
  request<StoreProfile[]>("/admin/read/store", {
    method: "POST",
    body: JSON.stringify({ page }),
  });
export const getExpiredTradeLicenses = async () => {
  const data = await request<StoreProfile[] | { stores?: StoreProfile[] }>(
    "/admin/read/expiredTradeLicenses",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.stores)) {
    return data.stores;
  }
  return [];
};
export const deleteStore = (id: string) =>
  request<unknown>(`/admin/edit/deleteStore/${id}`, { method: "DELETE" });

export type AdminStoreList = {
  stores: StoreProfile[];
  duplicateCount: number;
};

export type StoreEditInput = {
  storeId: string;
  storeName: string;
  marks?: string;
  alias?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  country?: string;
  contactNumber?: string;
  uid?: string;
  trnNo?: string;
  salesPerson?: string;
  tradeLicenseExpiry?: string;
  isTemp?: boolean;
  isTempStore?: boolean;
};

export type StoreCreateInput = {
  storeName: string;
  marks?: string;
  alias?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  country?: string;
  contactNumber?: string;
  uid?: string;
  trnNo?: string;
  salesPerson?: string;
  location?: string;
  tradeLicenseExpiry?: string;
};

export const getAdminStores = () =>
  siteRequest<AdminStoreList>("/api/admin/stores");

export const editAdminStore = (body: StoreEditInput) =>
  siteRequest<string>("/api/admin/stores/edit", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createAdminStore = (body: StoreCreateInput) =>
  request<{ store?: StoreProfile }>("/admin/create/store", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteAdminStore = (storeId: string) =>
  siteRequest<{ removed: number }>("/api/admin/stores/delete", {
    method: "POST",
    body: JSON.stringify({ storeId }),
  });

export const removeDuplicateStores = () =>
  siteRequest<{ removed: number }>("/api/admin/stores/dedupe", {
    method: "POST",
    body: JSON.stringify({}),
  });
export const filterStores = (body: Record<string, unknown>) =>
  request<StoreProfile[]>("/admin/storeProfile/filter", {
    method: "POST",
    body: JSON.stringify(body),
  });

// —— Profiles ——
async function unwrapUsers(path: string): Promise<ProfileUser[]> {
  const data = await request<ProfileUser[] | { users?: ProfileUser[] }>(path);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.users)) {
    return data.users;
  }
  return [];
}

export const getSalesProfiles = () => unwrapUsers("/admin/read/sales");
export const getWarehouseProfiles = () => unwrapUsers("/admin/read/warehouse");
export const getAdminProfiles = () => unwrapUsers("/admin/read/admin");
export const searchProfiles = (tag: string, role: string) =>
  request<{ users: ProfileUser[] }>("/admin/read/search", {
    method: "POST",
    body: JSON.stringify({ tag, role }),
  });
export const deleteUser = (id: string) =>
  request<unknown>(`/admin/edit/deleteUser/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export async function getProfile(role: "sales" | "warehouse", id: string) {
  const data = await request<unknown>(
    `/admin/read/${role}/${encodeURIComponent(id)}`,
  );
  if (!data || typeof data !== "object") {
    throw new ApiError("Profile not found", 404);
  }
  const payload = data as { user?: unknown };
  if (Array.isArray(payload.user) && payload.user[0]) {
    return payload.user[0] as ProfileUser;
  }
  if (payload.user && typeof payload.user === "object") {
    return payload.user as ProfileUser;
  }
  if ("_id" in data) return data as ProfileUser;
  throw new ApiError("Profile not found", 404);
}

export const updateSalesProfile = (id: string, body: Record<string, unknown>) =>
  request<unknown>(`/admin/edit/sales/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateWarehouseProfile = (
  id: string,
  body: Record<string, unknown>,
) =>
  request<unknown>(`/admin/edit/warehouse/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createSalesProfile = (body: Record<string, unknown>) =>
  request<unknown>("/admin/create/sales", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createWarehouseProfile = (body: Record<string, unknown>) =>
  request<unknown>("/admin/create/warehouse", {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface CompanyRecord {
  _id: string;
  name?: string;
  prefix?: string;
  productCount?: number;
}

export function companyLabel(company: Pick<CompanyRecord, "name" | "prefix">) {
  return company.name?.trim() || company.prefix?.trim() || "Company";
}

function asCompanyRecord(item: unknown): CompanyRecord | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = typeof o._id === "string" ? o._id : "";
  if (!id) return null;
  return {
    _id: id,
    name: o.name ? String(o.name) : undefined,
    prefix: o.prefix ? String(o.prefix) : undefined,
    productCount: Number(o.productCount) || 0,
  };
}

export async function getCompanies() {
  const data = await request<unknown>("/admin/company");
  if (!Array.isArray(data)) return [] as CompanyRecord[];
  return data
    .map(asCompanyRecord)
    .filter((item): item is CompanyRecord => Boolean(item));
}

const COMPANY_DIR_KEY = "stl_company_directory";
let companyDirectoryRefresh: Promise<CompanyRecord[]> | null = null;

function loadCompanyDirectory(): CompanyRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COMPANY_DIR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const rows = parsed
      .map(asCompanyRecord)
      .filter((item): item is CompanyRecord => Boolean(item));
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

function saveCompanyDirectory(companies: CompanyRecord[]) {
  if (typeof window === "undefined" || companies.length === 0) return;
  try {
    localStorage.setItem(
      COMPANY_DIR_KEY,
      JSON.stringify(
        companies.map((company) => ({
          _id: company._id,
          name: company.name,
          prefix: company.prefix,
        })),
      ),
    );
  } catch {
    /* The next company fetch can still resolve the choice. */
  }
}

/** Cache STL / SHMP ids so choosing a company does not wait on the directory. */
export function warmCompanyDirectory() {
  const refresh = () => {
    if (!companyDirectoryRefresh) {
      companyDirectoryRefresh = getCompanies()
        .then((rows) => {
          if (rows.length > 0) saveCompanyDirectory(rows);
          return rows;
        })
        .finally(() => {
          companyDirectoryRefresh = null;
        });
    }
    return companyDirectoryRefresh;
  };
  const cached = loadCompanyDirectory();
  if (cached) {
    void refresh().catch(() => {});
    return Promise.resolve(cached);
  }
  return refresh();
}

export interface CompanyProduct {
  _id: string;
  itemName?: string;
  itemRef?: string;
  company?: string;
  imagePath?: string;
}

export interface CompanyProductsPage {
  products: CompanyProduct[];
  page: number;
  total: number;
  hasMore: boolean;
}

function asCompanyProduct(item: unknown): CompanyProduct | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const rawId = o._id ?? o.id;
  const id = typeof rawId === "string" ? rawId : "";
  if (!id) return null;
  const company =
    typeof o.company === "string"
      ? o.company
      : o.company && typeof o.company === "object"
        ? String((o.company as { _id?: unknown })._id || "")
        : undefined;
  return {
    _id: id,
    itemName: o.itemName ? String(o.itemName) : undefined,
    itemRef: o.itemRef ? String(o.itemRef) : undefined,
    company: company || undefined,
    imagePath: typeof o.imagePath === "string" ? o.imagePath : undefined,
  };
}

export async function getCompanyProducts(
  companyId: string,
  page = 1,
  limit = 500,
  query = "",
): Promise<CompanyProductsPage> {
  const data = await request<unknown>("/admin/company/products", {
    method: "POST",
    body: JSON.stringify({
      companyId,
      page,
      limit,
      q: query.trim(),
    }),
  });
  if (Array.isArray(data)) {
    const products = data
      .map(asCompanyProduct)
      .filter((item): item is CompanyProduct => Boolean(item));
    return { products, page, total: products.length, hasMore: false };
  }
  const o =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const products = Array.isArray(o.products)
    ? o.products
        .map(asCompanyProduct)
        .filter((item): item is CompanyProduct => Boolean(item))
    : [];
  return {
    products,
    page: Number(o.page) || page,
    total: Number(o.total) || products.length,
    hasMore: Boolean(o.hasMore),
  };
}

export async function getAllCompanyProducts(
  companyId: string,
  onPage?: (soFar: CompanyProduct[], total: number) => void,
) {
  const products: CompanyProduct[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 80; page++) {
    const batch = await getCompanyProducts(companyId, page, 500);
    for (const product of batch.products) {
      if (seen.has(product._id)) continue;
      seen.add(product._id);
      products.push(product);
    }
    onPage?.(products, batch.total || products.length);
    if (!batch.hasMore || batch.products.length === 0) break;
  }
  return products;
}

export async function transferProductsToCompany(
  productIds: string[],
  companyId: string,
) {
  const ids = productIds.filter(Boolean);
  if (ids.length === 0) return 0;
  const data = await request<unknown>("/admin/company/transfer", {
    method: "PUT",
    body: JSON.stringify({ productIds: ids, companyId }),
  });
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    return Number(o.modified ?? o.matched ?? ids.length) || ids.length;
  }
  return ids.length;
}

// —— Products / Inventory ——
export const getProducts = (page = 1) =>
  request<Product[]>(`/admin/product?page=${page}`);

const API_PRODUCT_PAGE_SIZE = 50;

export async function getProductsPaged(
  page = 1,
  pageSize = API_PRODUCT_PAGE_SIZE,
): Promise<Product[]> {
  const size = Math.max(1, pageSize);
  const start = (page - 1) * size;
  const firstApiPage = Math.floor(start / API_PRODUCT_PAGE_SIZE) + 1;
  const lastApiPage = Math.floor((start + size - 1) / API_PRODUCT_PAGE_SIZE) + 1;
  const collected: Product[] = [];

  for (let apiPage = firstApiPage; apiPage <= lastApiPage; apiPage++) {
    const data = await getProducts(apiPage);
    const list = Array.isArray(data) ? data : [];
    collected.push(...list);
    if (list.length < API_PRODUCT_PAGE_SIZE) break;
  }

  const offset = start - (firstApiPage - 1) * API_PRODUCT_PAGE_SIZE;
  return collected.slice(offset, offset + size);
}

export async function getProduct(id: string): Promise<Product> {
  const data = await request<unknown>(
    `/admin/product/${encodeURIComponent(id)}`,
  );
  if (data && typeof data === "object") {
    const record = data as { Product?: Product };
    if (record.Product) return record.Product;
    return data as Product;
  }
  throw new ApiError("Product not found", 404);
}
export async function searchProducts(tag: string, page = 1) {
  const data = await request<unknown>("/admin/product/search", {
    method: "POST",
    body: JSON.stringify({ tag, page }),
  });
  return asProductList(data);
}
export const deleteProduct = (id: string) =>
  request<unknown>(`/admin/product/deleteProduct/${id}`, {
    method: "DELETE",
  });
export const addProductManual = (data: Record<string, unknown>) =>
  request<unknown>("/admin/product/uploadManual", {
    method: "POST",
    body: JSON.stringify(data),
  });

function typedInventoryFile(file: File) {
  const name = file.name.toLowerCase();
  let type = file.type;
  if (name.endsWith(".csv")) type = "text/csv";
  else if (name.endsWith(".xlsx")) {
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (name.endsWith(".xls")) type = "application/vnd.ms-excel";
  if (!type || type === file.type) return file;
  return new File([file], file.name, { type });
}

export async function uploadInventoryFile(file: File) {
  const name = file.name.toLowerCase();
  if (
    !name.endsWith(".csv") &&
    !name.endsWith(".xlsx") &&
    !name.endsWith(".xls")
  ) {
    throw new ApiError("Use a .xlsx or .csv file", 400);
  }
  const body = new FormData();
  body.append("singleFile", typedInventoryFile(file), file.name);
  const data = await request<unknown>("/admin/product/upload", {
    method: "POST",
    body,
  });
  return typeof data === "string" && data.trim()
    ? data
    : "Products sent for upload";
}

export function normalizeItemRef(ref: string) {
  return String(ref || "")
    .trim()
    .replace(/^'+/, "");
}

export interface ExistingInventoryItem {
  itemRef: string;
  itemName?: string;
  ratio?: number;
  amountInCartons?: number;
  amountInUnits?: number;
  sellingPrice?: number;
}

function asExistingInventoryItems(data: unknown): ExistingInventoryItem[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { products?: unknown }).products)
      ? (data as { products: unknown[] }).products
      : [];
  const items: ExistingInventoryItem[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const itemRef = normalizeItemRef(String(o.itemRef ?? ""));
    if (!itemRef) continue;
    const asNum = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    items.push({
      itemRef,
      itemName: o.itemName ? String(o.itemName) : undefined,
      ratio: asNum(o.ratio),
      amountInCartons: asNum(o.amountInCartons),
      amountInUnits: asNum(o.amountInUnits),
      sellingPrice: asNum(o.sellingPrice),
    });
  }
  return items;
}

async function lookupInventoryByItemRefs(itemRefs: string[]) {
  const unique = [
    ...new Set(itemRefs.map(normalizeItemRef).filter(Boolean)),
  ];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
  const concurrency = chunks.length <= 1 ? 1 : 2;
  const items: ExistingInventoryItem[] = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const pages = await Promise.all(
      chunks.slice(i, i + concurrency).map((chunk) =>
        request<unknown>("/admin/product/checkByItemRefs", {
          method: "POST",
          body: JSON.stringify({ itemRefs: chunk }),
        }),
      ),
    );
    for (const data of pages) items.push(...asExistingInventoryItems(data));
  }
  return items;
}

export async function checkProductsByItemRefs(itemRefs: string[]) {
  const unique = [
    ...new Set(itemRefs.map(normalizeItemRef).filter(Boolean)),
  ];
  if (unique.length === 0) return [] as ExistingInventoryItem[];

  const products: ExistingInventoryItem[] = [];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const data = await request<unknown>("/admin/product/checkByItemRefs", {
      method: "POST",
      body: JSON.stringify({ itemRefs: chunk }),
    });
    products.push(...asExistingInventoryItems(data));
  }
  return products;
}

export function existingItemLabel(item: {
  itemRef: string;
  itemName?: string;
}) {
  const name = item.itemName?.trim();
  return name ? `${item.itemRef} — ${name}` : item.itemRef;
}
export const updateProduct = (data: Record<string, unknown>) =>
  request<unknown>("/admin/product/update", {
    method: "PUT",
    body: JSON.stringify(data),
  });

async function authorizedFetch(path: string, options: RequestInit) {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  try {
    return await fetch(`${apiBase()}${path}`, {
      ...options,
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError(
      "Cannot reach the STL API. The request was blocked before your credentials were checked.",
      0,
    );
  }
}

export async function getCatalogTemplateStatus() {
  return request<{ ready: boolean }>("/admin/product/image/template");
}

export async function previewCatalogImage(productId: string, file: File) {
  const body = new FormData();
  body.append("productId", productId);
  body.append("image", file, file.name);
  const res = await authorizedFetch("/admin/product/image/preview", {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const payload = await parseBody(res);
    throw new ApiError(errorMessage(payload, `Request failed (${res.status})`), res.status);
  }
  return res.blob();
}

export async function uploadProductImage(
  productId: string,
  file: Blob,
  filename = "product.jpg",
) {
  const body = new FormData();
  body.append("productId", productId);
  const named = file instanceof File ? file : new File([file], filename, { type: "image/jpeg" });
  body.append("image", named, named.name);
  return request<{ imagePath: string; imageCount: number }>(
    "/admin/product/image",
    { method: "POST", body },
  );
}

export function createdProductId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const result = record.result;
  if (result && typeof result === "object" && "_id" in result) {
    return String((result as { _id?: unknown })._id ?? "");
  }
  if (record._id) return String(record._id);
  return "";
}
export const getCategories = () => request<unknown>("/admin/category");
export const getMasterCategories = () =>
  request<unknown>("/admin/category/master");
export const getCategoryManagers = () =>
  request<unknown>("/admin/category/manager");

export const readCategory = (catId: string) =>
  request<unknown>("/admin/category/read", {
    method: "POST",
    body: JSON.stringify({ catId }),
  });

export const createMasterCategory = (body: {
  masterCategoryName: string;
  awsMasterCatDir: string;
}) =>
  request<unknown>("/admin/category/create/master", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createSubCategory = (body: {
  masterCategoryId: string;
  subCategory: string;
  awsMasterCatDir: string;
  awsSubCatDir: string;
}) =>
  request<unknown>("/admin/category/create/sub", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const editMasterCategory = (body: Record<string, unknown>) =>
  request<unknown>("/admin/category/edit/master", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const editSubCategory = (body: Record<string, unknown>) =>
  request<unknown>("/admin/category/edit/sub", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteSubCategory = (catId: string) =>
  request<unknown>("/admin/category/delete", {
    method: "POST",
    body: JSON.stringify({ catId }),
  });

// —— Pending orders ——
export async function getPendingOrders(userId: string, page = 1, tabIndex = 0) {
  const data = await request<unknown>(
    `/warehouse/order/pending?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
  );
  return ordersFromWarehousePayload(data);
}

export type WarehouseTabIndex = 0 | 1 | 2 | 3 | 4;

export interface WarehouseOrdersResult {
  orders: PendingOrder[];
  counts?: WarehouseCounts;
}

function asWarehouseOrders(data: unknown): PendingOrder[] {
  return ordersFromWarehousePayload(data);
}

function asWarehouseCounts(data: unknown): WarehouseCounts | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const o = data as Record<string, unknown>;
  if (
    o.pendingCheckCount == null &&
    o.firstCheckCount == null &&
    o.totalPkgCount == null
  ) {
    return undefined;
  }
  return {
    pendingCheckCount: Number(o.pendingCheckCount) || 0,
    firstCheckCount: Number(o.firstCheckCount) || 0,
    doubleCheckCount: Number(o.doubleCheckCount) || 0,
    loadCheckCount: Number(o.loadCheckCount) || 0,
    unloadedCount: Number(o.unloadedCount) || 0,
    totalPkgCount: Number(o.totalPkgCount) || 0,
  };
}


function isUnloadedOrder(order: { unloaded?: unknown }) {
  return (
    order.unloaded === true ||
    order.unloaded === 1 ||
    order.unloaded === "true"
  );
}

function isOverdueIncomplete(order: PendingOrder) {
  // Load-checked orders stay off the Pending list until unloaded.
  if (order.loadCheck && !isUnloadedOrder(order)) return false;
  if (order.needsApproval === true) return false;
  const status = String(order.status || "").toLowerCase();
  if (status === "confirmed" || status === "order removed") return false;
  if (String(order.approvalStatus || "").toLowerCase() === "rejected") {
    return false;
  }
  if (!order.date) return false;
  const ms = new Date(order.date).getTime();
  if (Number.isNaN(ms)) return false;
  return ms < warehouseWorkDayRange().start.getTime();
}

function matchesWarehouseTab(
  order: PendingOrder,
  tabIndex: WarehouseTabIndex,
) {
  if (tabIndex === 2) return true;
  if (tabIndex === 3) return isOverdueIncomplete(order);
  if (!order.date) return false;
  const ms = new Date(order.date).getTime();
  if (Number.isNaN(ms)) return false;
  const { start, end } = warehouseWorkDayRange();
  if (tabIndex === 0) return ms >= start.getTime() && ms <= end.getTime();
  return ms > end.getTime();
}

function visibleWarehouseOrders(
  orders: PendingOrder[],
  tabIndex: WarehouseTabIndex,
) {
  return orders.filter((order) => {
    if (order.isDraft) return false;
    // Unloaded orders always belong on Pending, even when their delivery
    // date still sits in Upcoming/overdue buckets.
    if (isUnloadedOrder(order)) return true;
    return matchesWarehouseTab(order, tabIndex);
  });
}

/** Pending day (YYYY-MM-DD) so unloaded orders reappear on the Pending tab. */
function warehousePendingDateInput() {
  return warehouseWorkDayRange().start.toISOString().slice(0, 10);
}

function countsFromOrders(orders: PendingOrder[]): WarehouseCounts {
  let pendingCheckCount = 0;
  let firstCheckCount = 0;
  let doubleCheckCount = 0;
  let loadCheckCount = 0;
  let unloadedCount = 0;
  let totalPkgCount = 0;
  for (const order of orders) {
    totalPkgCount += Number(order.totalPkg) || 0;
    if (order.unloaded) unloadedCount += 1;
    else if (order.loadCheck) loadCheckCount += 1;
    else if (order.doubleCheck) doubleCheckCount += 1;
    else if (order.firstCheck) firstCheckCount += 1;
    else pendingCheckCount += 1;
  }
  return {
    pendingCheckCount,
    firstCheckCount,
    doubleCheckCount,
    loadCheckCount,
    unloadedCount,
    totalPkgCount,
  };
}

async function requestWarehouseOrderBatch(
  userId: string,
  page: number,
  tabIndex: WarehouseTabIndex,
  tag: string,
) {
  const query = tag.trim();
  const data = query
    ? await request<unknown>(
        `/warehouse/search?tag=${encodeURIComponent(query)}&userId=${encodeURIComponent(userId)}&orderType=${
          tabIndex === 2 ? "confirm" : "temp"
        }&tabIndex=${tabIndex}&page=${page}`,
      )
    : await request<unknown>(
        `/warehouse/order/${tabIndex === 2 ? "confirmed" : "pending"}?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
      );
  return {
    data,
    orders: asWarehouseOrders(data).filter((order) => !order.isDraft),
  };
}

function orderDeliveryMs(order: PendingOrder) {
  const ms = new Date(order.date || 0).getTime();
  return Number.isNaN(ms) ? Number.NaN : ms;
}

/**
 * The warehouse API still treats the next calendar day as pending. When that
 * day is Sunday and Sunday delivery is off, pull Monday out of upcoming.
 */
async function fetchSundaySkippedTab(
  userId: string,
  page: number,
  tabIndex: 0 | 1,
  tag: string,
) {
  const pageSize = tabIndex === 0 ? 100 : 50;
  const remotePageSize = 50;
  const range = warehouseWorkDayRange();
  const needed = page * pageSize;
  const matched: PendingOrder[] = [];
  const seen = new Set<string>();
  let remoteExhausted = false;

  for (let remotePage = 1; remotePage <= 40 && matched.length < needed; remotePage++) {
    const batch = await requestWarehouseOrderBatch(userId, remotePage, 1, tag);
    if (batch.orders.length === 0) {
      remoteExhausted = true;
      break;
    }
    for (const order of batch.orders) {
      const id = String(order._id || "");
      if (id && seen.has(id)) continue;
      const ms = orderDeliveryMs(order);
      if (Number.isNaN(ms)) continue;
      const keep =
        tabIndex === 0
          ? ms >= range.start.getTime() && ms <= range.end.getTime()
          : ms > range.end.getTime();
      if (!keep) continue;
      if (id) seen.add(id);
      matched.push(order);
    }
    if (batch.orders.length < remotePageSize) {
      remoteExhausted = true;
      break;
    }
  }

  const start = (page - 1) * pageSize;
  let orders = matched.slice(start, start + pageSize);
  if (tabIndex === 1) orders = [...orders].sort(byDeliveryDateAsc);
  if (tabIndex === 0) orders = sortPendingWarehouseOrders(orders);
  const more = matched.length > start + orders.length || !remoteExhausted;
  return {
    orders,
    counts: tabIndex === 0 ? countsFromOrders(orders) : undefined,
    pageSize,
    fetchedCount: more ? pageSize : Math.max(0, orders.length - (orders.length === pageSize ? 1 : 0)),
  };
}

export async function getWarehouseOrdersPage(
  userId: string,
  page: number,
  tabIndex: WarehouseTabIndex,
): Promise<WarehouseOrdersResult> {
  await loadSundayDeliverySetting();
  const kind = tabIndex === 2 ? "confirmed" : "pending";
  const data = await request<unknown>(
    `/warehouse/order/${kind}?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
  );
  const orders = visibleWarehouseOrders(asWarehouseOrders(data), tabIndex);
  return {
    orders,
    counts:
      tabIndex === 0 ? countsFromOrders(orders) : asWarehouseCounts(data),
  };
}

/** One API page for a warehouse tab — used for fast initial loads. */
export async function fetchWarehouseTabPage(
  userId: string,
  page: number,
  tabIndex: 0 | 1 | 2 | 3,
  tag = "",
): Promise<WarehouseOrdersResult & { pageSize: number; fetchedCount: number }> {
  await loadSundayDeliverySetting();
  if ((tabIndex === 0 || tabIndex === 1) && pendingSkipsSunday()) {
    return fetchSundaySkippedTab(userId, page, tabIndex, tag);
  }
  const pageSize = tabIndex === 0 ? 100 : 50;
  const query = tag.trim();
  const data = query
    ? await request<unknown>(
        `/warehouse/search?tag=${encodeURIComponent(query)}&userId=${encodeURIComponent(userId)}&orderType=${
          tabIndex === 2 ? "confirm" : "temp"
        }&tabIndex=${tabIndex}&page=${page}`,
      )
    : await request<unknown>(
        `/warehouse/order/${tabIndex === 2 ? "confirmed" : "pending"}?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
      );

  const raw = asWarehouseOrders(data).filter((order) => !order.isDraft);
  // Trust server tab filters for today/upcoming/confirmed. Pending keeps the
  // stricter incomplete-overdue filter used across the web app.
  let orders =
    tabIndex === 3
      ? visibleWarehouseOrders(raw, 3)
      : tabIndex === 0 || tabIndex === 1
        ? visibleWarehouseOrders(raw, tabIndex)
        : raw;
  if (tabIndex === 1) orders = [...orders].sort(byDeliveryDateAsc);
  if (tabIndex === 0) orders = sortPendingWarehouseOrders(orders);

  return {
    orders,
    counts:
      tabIndex === 0
        ? asWarehouseCounts(data) ?? countsFromOrders(orders)
        : undefined,
    pageSize,
    fetchedCount: raw.length,
  };
}

export async function searchWarehouseOrdersPage(
  userId: string,
  tag: string,
  page: number,
  tabIndex: WarehouseTabIndex,
): Promise<PendingOrder[]> {
  await loadSundayDeliverySetting();
  const orderType = tabIndex === 2 ? "confirm" : "temp";
  const data = await request<unknown>(
    `/warehouse/search?tag=${encodeURIComponent(tag)}&userId=${encodeURIComponent(userId)}&orderType=${orderType}&tabIndex=${tabIndex}&page=${page}`,
  );
  return visibleWarehouseOrders(asWarehouseOrders(data), tabIndex);
}

async function fetchPendingWarehousePage(
  userId: string,
  page: number,
  apiTab: 0 | 1 | 3,
  tag: string,
) {
  const query = tag.trim();
  const data = query
    ? await request<unknown>(
        `/warehouse/search?tag=${encodeURIComponent(query)}&userId=${encodeURIComponent(userId)}&orderType=temp&tabIndex=${apiTab}&page=${page}`,
      )
    : await request<unknown>(
        `/warehouse/order/pending?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${apiTab}`,
      );
  return asWarehouseOrders(data).filter((order) => !order.isDraft);
}

async function collectPendingWarehouseOrders(
  userId: string,
  tag: string,
) {
  const orders: PendingOrder[] = [];
  const seen = new Set<string>();
  for (const apiTab of [0, 1] as const) {
    const pageSize = apiTab === 0 ? 100 : 50;
    for (let page = 1; page <= 80; page++) {
      const batch = await fetchPendingWarehousePage(userId, page, apiTab, tag);
      let added = 0;
      for (const order of batch) {
        const id = String(order._id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        orders.push(order);
        added += 1;
      }
      if (batch.length < pageSize || batch.length > pageSize || added === 0) {
        break;
      }
    }
  }
  return orders;
}

function deliveryDateMs(order: PendingOrder) {
  const ms = new Date(order.date || 0).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function byDeliveryDateAsc(a: PendingOrder, b: PendingOrder) {
  return deliveryDateMs(a) - deliveryDateMs(b);
}

export async function getAllWarehouseOrders(
  userId: string,
  tabIndex: WarehouseTabIndex,
  tag = "",
  maxPages = 80,
): Promise<WarehouseOrdersResult> {
  await loadSundayDeliverySetting();
  if (tabIndex === 3) {
    const pending: PendingOrder[] = [];
    const seen = new Set<string>();
    const pageSize = 50;
    for (let page = 1; page <= 20; page++) {
      const batch = await fetchPendingWarehousePage(userId, page, 3, tag);
      let added = 0;
      for (const order of batch) {
        const id = String(order._id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        pending.push(order);
        added += 1;
      }
      if (batch.length < pageSize || added === 0) break;
    }
    const overdue = visibleWarehouseOrders(pending, 3).sort((a, b) => {
      const aMs = new Date(a.date || 0).getTime();
      const bMs = new Date(b.date || 0).getTime();
      return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs);
    });
    return { orders: overdue };
  }

  if (tabIndex === 0 || tabIndex === 1) {
    const pending = await collectPendingWarehouseOrders(userId, tag);
    let orders = visibleWarehouseOrders(pending, tabIndex);
    if (tabIndex === 1) orders.sort(byDeliveryDateAsc);
    if (tabIndex === 0) orders = sortPendingWarehouseOrders(orders);
    return {
      orders,
      counts: tabIndex === 0 ? countsFromOrders(orders) : undefined,
    };
  }

  const pageSize = 50;
  const orders: PendingOrder[] = [];
  const seen = new Set<string>();
  const query = tag.trim();
  const pageLimit = Math.max(1, Math.min(maxPages, 80));

  for (let page = 1; page <= pageLimit; page++) {
    const batch = query
      ? {
          orders: await searchWarehouseOrdersPage(userId, query, page, tabIndex),
          counts: undefined,
        }
      : await getWarehouseOrdersPage(userId, page, tabIndex);

    let added = 0;
    for (const order of batch.orders) {
      const id = String(order._id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orders.push(order);
      added += 1;
    }

    if (
      batch.orders.length < pageSize ||
      batch.orders.length > pageSize ||
      added === 0
    ) {
      break;
    }
  }

  return { orders };
}

function asCheckOrder(data: unknown): WarehouseCheckOrder | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const nested = o.tempOrder;
  if (nested && typeof nested === "object") {
    return nested as WarehouseCheckOrder;
  }
  if (typeof o._id === "string") return data as WarehouseCheckOrder;
  return null;
}

export async function getWarehouseCheckOrder(
  orderId: string,
  userId: string,
  checkNo: WarehouseCheckStep,
) {
  const data = await request<unknown>(
    `/mock/warehouse/product/pending?orderId=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(userId)}&checkNo=${checkNo}`,
  );
  const order = asCheckOrder(data);
  if (!order) throw new ApiError("Order not found", 404);
  return order;
}

function checkLinePayload(lines: WarehouseCheckLine[]) {
  return lines
    .map((line) => ({
      productId: warehouseLineProductId(line),
      quantityAv: Number(line.quantityAv) || 0,
      unitAv: line.unitAv || line.unitReq || "CARTONS",
      firstCheck: Boolean(line.firstCheck),
    }))
    .filter((line) => line.productId);
}

export const saveWarehouseCheck = (
  orderId: string,
  userId: string,
  lines: WarehouseCheckLine[],
) =>
  request<unknown>("/mock/warehouse/save", {
    method: "PUT",
    body: JSON.stringify({
      orderId,
      userId,
      productDetails: checkLinePayload(lines),
    }),
  });

export const confirmWarehouseCheck = (
  checkNo: WarehouseCheckStep,
  orderId: string,
  userId: string,
  lines: WarehouseCheckLine[],
  vehicleNumber?: string,
) =>
  request<unknown>(`/mock/warehouse/confirm/${checkNo}`, {
    method: "PUT",
    body: JSON.stringify({
      orderId,
      userId,
      productDetails: checkLinePayload(lines),
      ...(vehicleNumber ? { vehicleNumber } : {}),
    }),
  });

export async function unloadWarehouseOrder(orderId: string, userId: string) {
  await request<unknown>("/mock/warehouse/unload", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId }),
  });
  // Pending only loads today + overdue. Move the order into the warehouse
  // "today" window so it shows at the bottom of Pending after unload.
  try {
    await updateWarehouseDeliveryDate(
      orderId,
      userId,
      warehousePendingDateInput(),
    );
  } catch {
    // Unload already succeeded; list merge still keeps unloaded orders.
  }
}

export const toggleWarehouseLineCheck = (
  checkNo: WarehouseCheckStep,
  orderId: string,
  userId: string,
  productId: string,
  check: boolean,
) =>
  request<unknown>(`/mock/warehouse/check/${checkNo}`, {
    method: "PATCH",
    body: JSON.stringify({ check, productId, orderId, userId }),
  });

export const markWarehouseLineMissing = (
  orderId: string,
  userId: string,
  productId: string,
) =>
  request<unknown>("/mock/warehouse/missing", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId, productId }),
  });

export const checkAllWarehouseLines = (
  orderId: string,
  userId: string,
  checkNo: WarehouseCheckStep,
  check = true,
) =>
  request<unknown>("/mock/warehouse/checkAll", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId, checkNo, check }),
  });

export const generateWarehouseInvoice = (orderId: string, userId: string) =>
  request<unknown>("/mock/warehouse/invoice", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId }),
  });

export const updateWarehouseDeliveryDate = (
  orderId: string,
  userId: string,
  date: string,
) =>
  request<unknown>("/warehouse/date", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId, date }),
  });

export const updateWarehouseOrderStore = (
  orderId: string,
  userId: string,
  storeId: string,
) =>
  request<{
    isTempStore: boolean;
    store: {
      _id: string;
      storeName: string;
      marks: string;
      alias: string;
      city: string;
      country: string;
    };
  }>("/warehouse/store", {
    method: "PATCH",
    body: JSON.stringify({ orderId, userId, storeId }),
  });

export type WarehouseActionTag = "customs" | "daily" | "loading";

export const sendWarehouseActionSheet = (
  tag: WarehouseActionTag,
  userId: string,
) =>
  request<unknown>(
    `/mock/warehouse/action/${encodeURIComponent(tag)}?userId=${encodeURIComponent(userId)}`,
    { method: "GET", cache: "no-store" },
  );

const LIST_FILE_NAMES: Record<WarehouseActionTag, string> = {
  customs: "Custom List.xlsx",
  daily: "Zero List.xlsx",
  loading: "Loading List.xlsx",
};

export async function downloadWarehouseActionSheet(tag: WarehouseActionTag) {
  const headers = new Headers();
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  headers.set("Content-Type", "application/json");
  const res = await fetch("/api/warehouse/lists", {
    method: "POST",
    headers,
    body: JSON.stringify({ tag }),
  });
  if (!res.ok) {
    const body = await parseBody(res);
    throw new ApiError(
      errorMessage(body, `Request failed (${res.status})`),
      res.status,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = LIST_FILE_NAMES[tag];
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchLoadedWarehouseOrders(userId: string) {
  const data = await request<unknown>(
    `/warehouse/order/loaded?userId=${encodeURIComponent(userId)}`,
  );
  return asWarehouseOrders(data).filter(
    (order) => !order.isDraft && order.loadCheck && !order.unloaded,
  );
}

export const createLoadList = (body: {
  userId: string;
  driverName: string;
  vehicleNumber: string;
  orderIds: string[];
}) =>
  request<{
    message: string;
    orderCount: number;
    mailedTo: string;
    cc: string;
  }>("/mock/warehouse/load-list", {
    method: "POST",
    body: JSON.stringify(body),
  });

function warehouseLineProductId(line: WarehouseCheckLine) {
  if (typeof line.product === "string") return line.product;
  return line.product?._id || "";
}

export const exportTempOrders = (orderId: string[], userId: string) =>
  request<unknown>("/admin/export/tempOrder", {
    method: "POST",
    body: JSON.stringify({ orderId, userId }),
  });

export const deleteTempOrder = (orderId: string) =>
  request<unknown>("/admin/edit/deleteTempOrder", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });

export type DeleteWarehouseOrdersProgress = {
  total: number;
  deleted: number;
  failed: number;
  remaining: number;
};

const DELETE_ORDER_CHUNK = 25;

async function deleteOrderChunk(orderIds: string[]) {
  return request<{ message?: string; removed?: number; requested?: number } | string>(
    "/admin/edit/deleteTempOrder",
    {
      method: "POST",
      body: JSON.stringify({ orderIds }),
    },
  );
}

export async function deleteWarehouseOrders(
  orderIds: string[],
  onProgress?: (progress: DeleteWarehouseOrdersProgress) => void,
) {
  const ids = [...new Set(orderIds.map(String).filter(Boolean))];
  const total = ids.length;
  let deleted = 0;
  let failed = 0;
  const failures: string[] = [];

  const report = () => {
    onProgress?.({
      total,
      deleted,
      failed,
      remaining: Math.max(0, total - deleted - failed),
    });
  };

  report();

  for (let i = 0; i < ids.length; i += DELETE_ORDER_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_ORDER_CHUNK);
    try {
      await deleteOrderChunk(chunk);
      deleted += chunk.length;
      report();
      continue;
    } catch {
      // Fall back one-by-one so one bad id does not block the rest of the chunk.
    }

    for (const orderId of chunk) {
      try {
        await deleteTempOrder(orderId);
        deleted += 1;
      } catch (err) {
        failed += 1;
        failures.push(
          err instanceof Error ? err.message : "Failed to delete order",
        );
      }
      report();
    }
  }

  if (deleted === 0) {
    throw new Error(failures[0] || "Failed to delete orders");
  }

  return { total, deleted, failed };
}

export const exportInventory = (userId: string) =>
  request<unknown>("/admin/export/products", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

export const exportPayments = (
  userId: string,
  startDate: string,
  endDate: string,
) =>
  request<unknown>("/admin/export/payment", {
    method: "POST",
    body: JSON.stringify({ userId, startDate, endDate }),
  });

export const exportPendingPayments = (
  userId: string,
  startDate: string,
  endDate: string,
) =>
  request<unknown>("/admin/export/pendingPayment", {
    method: "POST",
    body: JSON.stringify({ userId, startDate, endDate }),
  });

// —— Approvals ——
function asApprovalOrders(data: unknown): ApprovalOrder[] {
  if (Array.isArray(data)) return data as ApprovalOrder[];
  return [];
}

export const getApprovalQueue = async () =>
  asApprovalOrders(await request<unknown>("/sales/approvalQueue"));

export const getSalesApprovals = async (salesId: string) =>
  asApprovalOrders(
    await request<unknown>(
      `/sales/approvals?salesId=${encodeURIComponent(salesId)}`,
    ),
  );

export async function decideApproval(
  orderId: string,
  approved: boolean,
  rejectNote = "",
) {
  const body = JSON.stringify({
    orderId: String(orderId),
    approved,
    rejectNote,
  });
  try {
    return await request<unknown>("/sales/approvalDecide", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    return request<unknown>("/mock/sales/approvalDecide", {
      method: "POST",
      body,
    });
  }
}

export const placeApprovedOrder = (tempOrderId: string, salesId: string) =>
  request<unknown>("/sales/placeApprovedOrder", {
    method: "POST",
    body: JSON.stringify({ tempOrderId, salesId }),
  });

export const resubmitApprovalOrder = (body: Record<string, unknown>) =>
  request<unknown>("/sales/tempOrder", {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface SalesStorePage {
  myStores: StoreProfile[];
  otherStores: StoreProfile[];
}

export const SALES_STORE_PAGE_SIZE = 30;
const SALES_STORE_API_PAGE_SIZE = 50;

function parseSalesStorePage(data: unknown): SalesStorePage {
  if (!data || typeof data !== "object") {
    return { myStores: [], otherStores: [] };
  }
  const o = data as Record<string, unknown>;
  return {
    myStores: asStoreList(o.myStoreArr ?? o.myStores),
    otherStores: asStoreList(o.otherStore ?? o.otherStores),
  };
}

function shouldUseShmpStoreFallback(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return (
    error.status === 404 ||
    error.status === 0 ||
    /cannot (get|post)|not found/i.test(error.message)
  );
}

async function requestShmpStorePage(userId: string, page: number) {
  try {
    return parseSalesStorePage(
      await request<unknown>("/sales/shmpStore", {
        method: "POST",
        body: JSON.stringify({ userId, page }),
      }),
    );
  } catch (error) {
    if (!shouldUseShmpStoreFallback(error)) throw error;
    return parseSalesStorePage(
      await siteRequest<unknown>("/api/sales/shmp-stores", {
        method: "POST",
        body: JSON.stringify({ userId, page }),
      }),
    );
  }
}

async function searchShmpStorePage(tag: string, page: number, userId: string) {
  try {
    return asStoreList(
      await request<unknown>("/sales/searchShmpStore", {
        method: "POST",
        body: JSON.stringify({ tag, page, userId }),
      }),
    );
  } catch (error) {
    if (!shouldUseShmpStoreFallback(error)) throw error;
    const data = await siteRequest<unknown>("/api/sales/shmp-stores", {
      method: "POST",
      body: JSON.stringify({ userId, tag, page }),
    });
    if (Array.isArray(data)) return asStoreList(data);
    return parseSalesStorePage(data).myStores;
  }
}

async function downloadShmpAssignedStores(userId: string) {
  try {
    return asStoreList(
      await request<unknown>(
        `/sales/shmpStore?userId=${encodeURIComponent(userId)}`,
      ),
    );
  } catch (error) {
    if (!shouldUseShmpStoreFallback(error)) throw error;
    return asStoreList(
      await siteRequest<unknown>(
        `/api/sales/shmp-stores?userId=${encodeURIComponent(userId)}`,
      ),
    );
  }
}

export async function getSalesStorePage(
  userId: string,
  page = 1,
  company?: SalesCompanyKey | null,
): Promise<SalesStorePage> {
  if (company === "shmp") return requestShmpStorePage(userId, page);
  const data = await request<unknown>("/sales/store", {
    method: "POST",
    body: JSON.stringify({ userId, page }),
  });
  return parseSalesStorePage(data);
}

export async function searchSalesStores(
  tag: string,
  page = 1,
  company?: SalesCompanyKey | null,
  userId?: string,
) {
  if (company === "shmp") {
    return searchShmpStorePage(
      tag,
      page,
      userId || getStoredAuth()?.id || "",
    );
  }
  const data = await request<unknown>("/sales/searchStore", {
    method: "POST",
    body: JSON.stringify({ tag, page }),
  });
  return asStoreList(data);
}

export type SalesStoreCache = {
  myStores: StoreProfile[] | null;
  other: Map<number, StoreProfile[]>;
  search: Map<string, Map<number, StoreProfile[]>>;
};

export function createSalesStoreCache(): SalesStoreCache {
  return { myStores: null, other: new Map(), search: new Map() };
}

async function otherStoreApiPage(
  userId: string,
  apiPage: number,
  cache: SalesStoreCache,
  company?: SalesCompanyKey | null,
) {
  const cached = cache.other.get(apiPage);
  if (cached) return cached;
  const batch = await getSalesStorePage(userId, apiPage, company);
  if (apiPage === 1) cache.myStores = batch.myStores;
  cache.other.set(apiPage, batch.otherStores);
  return batch.otherStores;
}

async function searchStoreApiPage(
  tag: string,
  apiPage: number,
  cache: SalesStoreCache,
  company?: SalesCompanyKey | null,
  userId?: string,
) {
  let pages = cache.search.get(tag);
  if (!pages) {
    pages = new Map();
    cache.search.set(tag, pages);
  }
  const cached = pages.get(apiPage);
  if (cached) return cached;
  const list = await searchSalesStores(tag, apiPage, company, userId);
  pages.set(apiPage, list);
  return list;
}

function storeAtApiIndex(list: StoreProfile[], index: number) {
  const offset = index % SALES_STORE_API_PAGE_SIZE;
  if (index >= 0 && offset < list.length) return list[offset];
  return undefined;
}

export async function loadSalesStoreUiPage(
  userId: string,
  uiPage: number,
  cache: SalesStoreCache,
  company?: SalesCompanyKey | null,
) {
  const start = (uiPage - 1) * SALES_STORE_PAGE_SIZE;
  await otherStoreApiPage(userId, 1, cache, company);
  const my = cache.myStores ?? [];

  const stores: StoreProfile[] = [];
  for (let i = start; i < start + SALES_STORE_PAGE_SIZE; i++) {
    if (i < my.length) {
      stores.push(my[i]);
      continue;
    }
    const otherIndex = i - my.length;
    const apiPage = Math.floor(otherIndex / SALES_STORE_API_PAGE_SIZE) + 1;
    const list = await otherStoreApiPage(userId, apiPage, cache, company);
    const item = storeAtApiIndex(list, otherIndex);
    if (!item) break;
    stores.push(item);
  }

  const nextIndex = start + SALES_STORE_PAGE_SIZE;
  let hasNext = false;
  if (nextIndex < my.length) {
    hasNext = true;
  } else {
    const otherIndex = nextIndex - my.length;
    const apiPage = Math.floor(otherIndex / SALES_STORE_API_PAGE_SIZE) + 1;
    const list = await otherStoreApiPage(userId, apiPage, cache, company);
    hasNext = Boolean(storeAtApiIndex(list, otherIndex));
  }

  const myIds = new Set(my.map((store) => store._id));
  return {
    stores,
    myStores: stores.filter((store) => myIds.has(store._id)),
    otherStores: stores.filter((store) => !myIds.has(store._id)),
    hasNext,
    hasPrev: uiPage > 1,
  };
}

export async function loadSalesStoreSearchPage(
  tag: string,
  uiPage: number,
  cache: SalesStoreCache,
  company?: SalesCompanyKey | null,
  userId?: string,
) {
  const start = (uiPage - 1) * SALES_STORE_PAGE_SIZE;
  const stores: StoreProfile[] = [];
  for (let i = start; i < start + SALES_STORE_PAGE_SIZE; i++) {
    const apiPage = Math.floor(i / SALES_STORE_API_PAGE_SIZE) + 1;
    const list = await searchStoreApiPage(tag, apiPage, cache, company, userId);
    const item = storeAtApiIndex(list, i);
    if (!item) break;
    stores.push(item);
  }

  const nextIndex = start + SALES_STORE_PAGE_SIZE;
  const nextApiPage = Math.floor(nextIndex / SALES_STORE_API_PAGE_SIZE) + 1;
  const nextList = await searchStoreApiPage(
    tag,
    nextApiPage,
    cache,
    company,
    userId,
  );
  return {
    stores,
    hasNext: Boolean(storeAtApiIndex(nextList, nextIndex)),
    hasPrev: uiPage > 1,
  };
}

export async function downloadSalesStores(
  userId?: string,
  company?: SalesCompanyKey | null,
) {
  if (company === "shmp") {
    if (!userId) return [] as StoreProfile[];
    const downloaded = await downloadShmpAssignedStores(userId);
    const byId = new Map(downloaded.map((store) => [store._id, store]));
    try {
      const page = await requestShmpStorePage(userId, 1);
      for (const store of page.myStores) {
        byId.set(store._id, { ...byId.get(store._id), ...store });
      }
    } catch {
      /* Keep the assigned download even if paging fails. */
    }
    return [...byId.values()];
  }
  const downloaded = asStoreList(await request<unknown>("/sales/store"));
  const byId = new Map(downloaded.map((store) => [store._id, store]));
  if (userId) {
    try {
      const data = await request<{ myStoreArr?: StoreProfile[] }>("/sales/store", {
        method: "POST",
        body: JSON.stringify({ userId, page: 1 }),
      });
      for (const store of data.myStoreArr || []) {
        const existing = byId.get(store._id);
        const isTemp = Boolean(
          store.isTemp ||
            store.isTempStore ||
            existing?.isTemp ||
            existing?.isTempStore ||
            (downloaded.length > 0 && !existing),
        );
        byId.set(store._id, {
          ...existing,
          ...store,
          isTemp,
          isTempStore: isTemp,
        });
      }
    } catch {
      /* Keep the full store download even if my-store paging fails. */
    }
  }
  return [...byId.values()];
}

function parseSalesCompanyAccess(data: unknown): SalesCompanyAccess | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.companyIds) && !Array.isArray(o.companyNames)) return null;
  return {
    companyIds: Array.isArray(o.companyIds)
      ? o.companyIds.map((id) => String(id || "")).filter(Boolean)
      : [],
    companyNames: Array.isArray(o.companyNames)
      ? o.companyNames.map((name) => String(name || "").trim()).filter(Boolean)
      : [],
    includeUnassigned: false,
  };
}

export async function getSalesCompanyAccess(
  userId: string,
): Promise<SalesCompanyAccess> {
  const selected = loadSelectedSalesCompany();
  if (selected) return accessFromSelectedCompany(selected);

  try {
    const user = await getProfile("sales", userId);
    const companies = await getCompanies().catch(() => [] as CompanyRecord[]);
    return resolveCatalogAccess(
      companyIds(salesField(user).company),
      companies,
    );
  } catch {
    /* Fall through to other access sources. */
  }
  try {
    const data = await request<unknown>(
      `/sales/access?userId=${encodeURIComponent(userId)}`,
    );
    const parsed = parseSalesCompanyAccess(data);
    if (parsed) return parsed;
  } catch {
    /* Origin may not have /sales/access yet. */
  }
  const data = await siteRequest<unknown>(
    `/api/sales/access?userId=${encodeURIComponent(userId)}`,
  );
  return (
    parseSalesCompanyAccess(data) || {
      companyIds: [],
      companyNames: [],
      includeUnassigned: false,
    }
  );
}

/** Persist STL/SHMP and open inventory without waiting for the full catalog. */
export async function selectSalesCompany(
  userId: string,
  key: SalesCompanyKey,
  options?: { keepWorkspace?: boolean },
) {
  if (!isSalesInventoryKey(key)) {
    throw new Error(
      `${SALES_COMPANY_LABELS[key] || "This company"} is not available yet.`,
    );
  }
  const companies = await warmCompanyDirectory();
  const resolved = resolveSalesCompanyByKey(key, companies);
  if (!resolved) {
    throw new Error(
      `Could not find ${SALES_COMPANY_LABELS[key] || key.toUpperCase()} in company list. Ask admin to add it, then try again.`,
    );
  }
  const access = accessFromSelectedCompany(resolved);
  const catalogKey = accessKey(access);
  const existing = loadCachedCatalog();
  if (existing?.accessKey === catalogKey && existing.products.length > 0) {
    saveSalesCompanyAccess(access);
    saveSelectedSalesCompany(resolved);
    if (!options?.keepWorkspace) saveSalesWorkspace(key);
    warmSalesInventoryIndex();
    return { access, products: catalogForAccess(access) || existing.products };
  }
  catalogGeneration += 1;
  const generation = catalogGeneration;
  resetCompanyInventoryMemory();
  dropSalesCatalogCache();
  saveSalesCompanyAccess(access);
  const firstPage = prefetchCompanyInventoryPage(resolved.id, 1);
  saveSelectedSalesCompany(resolved);
  if (!options?.keepWorkspace) saveSalesWorkspace(key);
  void firstPage.finally(() => {
    queueSalesCatalogDownload(userId, access, generation);
  });
  return { access, products: [] as Product[] };
}

export async function refreshSalesCompanyAccess(userId: string) {
  try {
    const access = await getSalesCompanyAccess(userId);
    saveSalesCompanyAccess(access);
    return access;
  } catch {
    return loadSalesCompanyAccess();
  }
}

export async function downloadSalesCatalog(userId: string) {
  const data = await request<unknown>(
    `/sales/product?salesId=${encodeURIComponent(userId)}`,
  );
  return asProductList(data);
}

const SALES_ACCESS_REFRESH_MS = 30_000;
let lastSalesAccessCheck = 0;
let salesSyncInflight: {
  userId: string;
  promise: Promise<{ access: SalesCompanyAccess; products: Product[] }>;
} | null = null;
let salesCatalogDownload: {
  key: string;
  generation: number;
  promise: Promise<{ access: SalesCompanyAccess; products: Product[] }>;
} | null = null;
let catalogGeneration = 0;
let companyInventoryGate: Promise<unknown> | null = null;
const companyStubCache = new Map<string, Product[]>();
const companyStubInflight = new Map<string, Promise<Product[]>>();
const companyPageCache = new Map<
  string,
  Promise<{ products: Product[]; hasNext: boolean }>
>();

function resetCompanyInventoryMemory() {
  companyStubCache.clear();
  companyStubInflight.clear();
  companyPageCache.clear();
  companyInventoryGate = null;
}

function companyStubToProduct(row: CompanyProduct, companyId: string): Product {
  return {
    _id: row._id,
    itemRef: row.itemRef,
    itemName: row.itemName,
    company: row.company || companyId,
  };
}

async function enrichSalesProducts(products: Product[]) {
  if (products.length === 0) return products;
  const details = await lookupInventoryByItemRefs(
    products.map((product) => product.itemRef || ""),
  );
  const byRef = new Map(
    details.map((item) => [normalizeItemRef(item.itemRef), item]),
  );
  return products.map((product) => {
    const detail = byRef.get(normalizeItemRef(product.itemRef || ""));
    if (!detail) return product;
    return {
      ...product,
      itemName: product.itemName || detail.itemName,
      ratio: detail.ratio,
      sellingPrice: detail.sellingPrice,
      inQty: {
        amountInCartons: detail.amountInCartons,
        amountInUnits: detail.amountInUnits,
      },
    };
  });
}

async function ensureCompanyStubs(companyId: string) {
  const cached = companyStubCache.get(companyId);
  if (cached) return cached;
  let pending = companyStubInflight.get(companyId);
  if (!pending) {
    pending = getAllCompanyProducts(companyId)
      .then((rows) => {
        const products = rows.map((row) => companyStubToProduct(row, companyId));
        companyStubCache.set(companyId, products);
        return products;
      })
      .finally(() => {
        companyStubInflight.delete(companyId);
      });
    companyStubInflight.set(companyId, pending);
  }
  return pending;
}

async function sliceCompanyStubs(stubs: Product[], uiPage: number) {
  const start = Math.max(0, uiPage - 1) * SALES_INVENTORY_PAGE_SIZE;
  const slice = stubs.slice(start, start + SALES_INVENTORY_PAGE_SIZE);
  return {
    products: await enrichSalesProducts(slice),
    hasNext: stubs.length > start + SALES_INVENTORY_PAGE_SIZE,
  };
}

async function loadCompanyInventorySlice(companyId: string, uiPage: number) {
  const stubs = companyStubCache.get(companyId);
  if (stubs && stubs.length > 0) return sliceCompanyStubs(stubs, uiPage);
  const batch = await getCompanyProducts(
    companyId,
    uiPage,
    SALES_INVENTORY_PAGE_SIZE,
  );
  const rows = batch.products.map((row) => companyStubToProduct(row, companyId));
  const fullDump =
    uiPage === 1 &&
    !batch.hasMore &&
    rows.length > SALES_INVENTORY_PAGE_SIZE &&
    (batch.total === rows.length || batch.total === 0);
  if (fullDump) {
    companyStubCache.set(companyId, rows);
    return sliceCompanyStubs(rows, uiPage);
  }
  const pageRows = rows.slice(0, SALES_INVENTORY_PAGE_SIZE);
  return {
    products: await enrichSalesProducts(pageRows),
    hasNext:
      batch.hasMore ||
      batch.total > uiPage * SALES_INVENTORY_PAGE_SIZE ||
      rows.length > SALES_INVENTORY_PAGE_SIZE,
  };
}

function prefetchCompanyInventoryPage(companyId: string, uiPage = 1) {
  const key = `${companyId}:${uiPage}`;
  let pending = companyPageCache.get(key);
  if (!pending) {
    pending = loadCompanyInventorySlice(companyId, uiPage).catch((error) => {
      companyPageCache.delete(key);
      throw error;
    });
    companyPageCache.set(key, pending);
  }
  if (uiPage === 1) {
    companyInventoryGate = pending.finally(() => {
      if (companyInventoryGate === pending) companyInventoryGate = null;
    });
  }
  return pending;
}

function warmSalesInventoryIndex() {
  const catalog = catalogForAccess(loadSalesCompanyAccess());
  if (!catalog || catalog.length === 0) return;
  const build = () => {
    salesCatalogRows(catalog);
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(build);
  } else {
    setTimeout(build, 50);
  }
}

/** STL's full catalog is large enough that store paging already returns it first. */
const ASSIGNED_COMPANY_CATALOG_MAX = 2500;

/**
 * `/sales/product` times out, and `/sales/products` is STL-first, so a smaller
 * company such as SHMP never appears on the first page. Build that catalog
 * from the company assignment list instead.
 */
async function catalogFromAssignedCompanies(
  access: SalesCompanyAccess,
): Promise<Product[]> {
  const products: Product[] = [];
  for (const companyId of access.companyIds) {
    const rows = await ensureCompanyStubs(companyId);
    if (rows.length === 0 || rows.length > ASSIGNED_COMPANY_CATALOG_MAX) continue;
    products.push(...rows);
  }
  if (products.length === 0) return [];
  return enrichSalesProducts(products);
}

async function publishSalesCatalog(
  access: SalesCompanyAccess,
  products: Product[],
) {
  const allowed = filterAllowedProducts(products, access);
  if (allowed.length > 0) {
    saveAllowedProductIds(
      access,
      allowed.map((product) => product._id),
    );
    replaceCachedCatalog(access, allowed);
  } else saveSalesCompanyAccess(access);
  warmSalesInventoryIndex();
  return catalogForAccess(access) || allowed;
}

function downloadSalesCatalogForAccess(
  userId: string,
  access: SalesCompanyAccess,
  generation = catalogGeneration,
) {
  const key = accessKey(access);
  if (
    salesCatalogDownload?.key === key &&
    salesCatalogDownload.generation === generation
  ) {
    return salesCatalogDownload.promise;
  }
  const promise = (async () => {
    if (generation !== catalogGeneration) {
      return { access, products: [] as Product[] };
    }
    try {
      const assigned = await catalogFromAssignedCompanies(access).catch(
        () => [] as Product[],
      );
      if (generation !== catalogGeneration) {
        return { access, products: [] as Product[] };
      }
      if (assigned.length > 0) {
        const products = await publishSalesCatalog(access, assigned);
        return { access, products };
      }
      const products = await publishSalesCatalog(
        access,
        await downloadSalesCatalog(userId),
      );
      return { access, products };
    } catch {
      if (generation !== catalogGeneration) {
        return { access, products: [] as Product[] };
      }
      const leftover = filterAllowedProducts(
        loadCachedCatalog()?.products || [],
        access,
      );
      if (leftover.length > 0) {
        const products = await publishSalesCatalog(access, leftover);
        return { access, products };
      }
      saveSalesCompanyAccess(access);
      return { access, products: leftover };
    }
  })().finally(() => {
    if (salesCatalogDownload?.promise === promise) salesCatalogDownload = null;
  });
  salesCatalogDownload = { key, generation, promise };
  return promise;
}

function queueSalesCatalogDownload(
  userId: string,
  access: SalesCompanyAccess,
  generation = catalogGeneration,
) {
  const start = () => {
    if (generation !== catalogGeneration) return;
    void downloadSalesCatalogForAccess(userId, access, generation);
  };
  const gate = companyInventoryGate?.catch(() => undefined) ?? Promise.resolve();
  void gate.finally(() => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => start(), { timeout: 1500 });
    } else {
      setTimeout(start, 400);
    }
  });
}

function scheduleSalesCatalogDownload(userId: string, access: SalesCompanyAccess) {
  queueSalesCatalogDownload(userId, access, catalogGeneration);
}

async function refreshSalesAccessIfStale(
  userId: string,
  previous: SalesCompanyAccess,
) {
  if (Date.now() - lastSalesAccessCheck < SALES_ACCESS_REFRESH_MS) return;
  lastSalesAccessCheck = Date.now();
  try {
    const access = await getSalesCompanyAccess(userId);
    if (accessKey(previous) === accessKey(access)) {
      saveSalesCompanyAccess(access);
      return;
    }
    await downloadSalesCatalogForAccess(userId, access);
  } catch {
    /* Keep the catalog already on screen. */
  }
}

export async function syncSalesInventory(userId: string) {
  if (salesSyncInflight?.userId === userId) return salesSyncInflight.promise;
  const promise = runSalesInventorySync(userId).finally(() => {
    if (salesSyncInflight?.promise === promise) salesSyncInflight = null;
  });
  salesSyncInflight = { userId, promise };
  return promise;
}

async function runSalesInventorySync(userId: string) {
  const previous = loadSalesCompanyAccess();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { access: previous, products: catalogForAccess(previous) || [] };
  }
  const cached = catalogForAccess(previous);
  if (cached && cached.length > 0) {
    warmSalesInventoryIndex();
    void refreshSalesAccessIfStale(userId, previous);
    return { access: previous, products: cached };
  }
  let access = previous;
  try {
    access = await getSalesCompanyAccess(userId);
    lastSalesAccessCheck = Date.now();
  } catch {
    return { access: previous, products: catalogForAccess(previous) || [] };
  }
  if (accessKey(previous) === accessKey(access)) {
    const ready = catalogForAccess(access);
    if (ready && ready.length > 0) {
      saveSalesCompanyAccess(access);
      warmSalesInventoryIndex();
      return { access, products: ready };
    }
  }
  scheduleSalesCatalogDownload(userId, access);
  return { access, products: catalogForAccess(access) || [] };
}

function allowedSalesProducts(list: Product[]) {
  return filterAllowedProducts(list, loadSalesCompanyAccess());
}

function withCompanyBody(body: Record<string, unknown>) {
  const access = loadSalesCompanyAccess();
  return { ...body, ...companyQueryPayload(access) };
}

async function rawStoreProducts(
  storeId: string,
  userId: string,
  page = 1,
  tempStore = false,
) {
  const data = await request<unknown>("/sales/products", {
    method: "POST",
    body: JSON.stringify(
      withCompanyBody({
        storeId,
        userId,
        page,
        tempStore: tempStore ? "true" : "false",
      }),
    ),
  });
  return asProductList(data);
}

export async function getStoreProducts(
  storeId: string,
  userId: string,
  page = 1,
  tempStore = false,
) {
  return allowedSalesProducts(
    await rawStoreProducts(storeId, userId, page, tempStore),
  );
}

async function rawSearchStoreProducts(
  storeId: string,
  tag: string,
  page = 1,
  tempStore = false,
) {
  const data = await request<unknown>("/sales/search", {
    method: "POST",
    body: JSON.stringify(
      withCompanyBody({
        storeId,
        tag,
        page,
        userId: getStoredAuth()?.id,
        tempStore: tempStore ? "true" : "false",
      }),
    ),
  });
  return asProductList(data);
}

export async function searchStoreProducts(
  storeId: string,
  tag: string,
  page = 1,
  tempStore = false,
) {
  return allowedSalesProducts(
    await rawSearchStoreProducts(storeId, tag, page, tempStore),
  );
}

async function rawFilterStoreProducts(
  storeId: string,
  page = 1,
  tempStore = false,
  cat: string,
  subCat = "",
) {
  const data = await request<unknown>("/sales/filter", {
    method: "POST",
    body: JSON.stringify(
      withCompanyBody({
        storeId,
        page,
        userId: getStoredAuth()?.id,
        tempStore: tempStore ? "true" : "false",
        cat,
        subCat,
      }),
    ),
  });
  return asProductList(data);
}

export async function filterStoreProducts(
  storeId: string,
  page = 1,
  tempStore = false,
  cat: string,
  subCat = "",
) {
  return allowedSalesProducts(
    await rawFilterStoreProducts(storeId, page, tempStore, cat, subCat),
  );
}

export const SALES_INVENTORY_PAGE_SIZE = 30;
const SALES_INVENTORY_API_PAGE_SIZE = 50;

export type SalesProductCache = Map<string, Map<number, Product[]>>;

export function createSalesProductCache(): SalesProductCache {
  return new Map();
}

const rawPageSizes = new WeakMap<SalesProductCache, Map<string, Map<number, number>>>();

function pageSizeBucket(cache: SalesProductCache, key: string) {
  let sizes = rawPageSizes.get(cache);
  if (!sizes) {
    sizes = new Map();
    rawPageSizes.set(cache, sizes);
  }
  let pages = sizes.get(key);
  if (!pages) {
    pages = new Map();
    sizes.set(key, pages);
  }
  return pages;
}

function productCacheKey(
  storeId: string,
  tag: string,
  tempStore: boolean,
  cat: string,
  subCat: string,
) {
  return `${storeId}::${tempStore ? "t" : "s"}::${tag}::${cat}::${subCat}`;
}

async function inventoryApiPage(
  storeId: string,
  userId: string,
  tag: string,
  apiPage: number,
  cache: SalesProductCache,
  tempStore = false,
  cat = "",
  subCat = "",
) {
  const key = productCacheKey(storeId, tag, tempStore, cat, subCat);
  let pages = cache.get(key);
  if (!pages) {
    pages = new Map();
    cache.set(key, pages);
  }
  const cached = pages.get(apiPage);
  if (cached) return cached;
  const sizes = pageSizeBucket(cache, key);
  try {
    let raw: Product[];
    if (tag && (cat || subCat)) {
      const data = await request<unknown>("/sales/searchFilter", {
        method: "POST",
        body: JSON.stringify(
          withCompanyBody({
            storeId,
            tag,
            page: apiPage,
            userId,
            tempStore: tempStore ? "true" : "false",
            cat,
            subCat,
          }),
        ),
      });
      raw = asProductList(data);
    } else if (tag) {
      raw = await rawSearchStoreProducts(storeId, tag, apiPage, tempStore);
    } else if (cat || subCat) {
      raw = await rawFilterStoreProducts(
        storeId,
        apiPage,
        tempStore,
        cat,
        subCat,
      );
    } else {
      raw = await rawStoreProducts(storeId, userId, apiPage, tempStore);
    }
    const list = allowedSalesProducts(raw);
    pages.set(apiPage, list);
    sizes.set(apiPage, raw.length);
    return list;
  } catch {
    const empty: Product[] = [];
    pages.set(apiPage, empty);
    sizes.set(apiPage, 0);
    return empty;
  }
}

function productAtApiIndex(list: Product[], index: number) {
  const offset = index % SALES_INVENTORY_API_PAGE_SIZE;
  if (index >= 0 && offset < list.length) return list[offset];
  return undefined;
}

type SalesCatalogRow = {
  product: Product;
  hay: string;
  categories: string[];
  subId: string;
  subName: string;
};

let indexedSalesCatalog: Product[] | null = null;
let indexedSalesRows: SalesCatalogRow[] | null = null;

function salesCatalogRows(catalog: Product[]) {
  if (indexedSalesCatalog === catalog && indexedSalesRows) return indexedSalesRows;
  indexedSalesRows = catalog.map((product) => {
    const category =
      product.category && typeof product.category === "object" ? product.category : null;
    const named = category as {
      masterCategory?: string;
      masterCategoryName?: string;
      masterCategoryId?: string;
      subCategory?: string;
      _id?: string;
    } | null;
    return {
      product,
      hay: [product.itemName, product.itemRef, product.barCode, product.barcode]
        .map((value) => String(value || "").toLowerCase())
        .join(" "),
      categories: [
        product.masterCategoryId,
        product.masterCategoryName,
        named?.masterCategoryId,
        named?.masterCategoryName || named?.masterCategory,
      ]
        .map((value) => String(value || ""))
        .filter(Boolean),
      subId: named?._id
        ? String(named._id)
        : String(product.categoryId || product.subCategoryId || ""),
      subName: named ? String(named.subCategory || "") : "",
    };
  });
  indexedSalesCatalog = catalog;
  return indexedSalesRows;
}

function catalogSupportsCategoryFilter(catalog: Product[]) {
  return catalog.some((product) => {
    const category = product.category;
    if (category && typeof category === "object") {
      const named = category as {
        masterCategoryName?: string;
        masterCategory?: string;
        subCategory?: string;
        masterCategoryId?: string;
      };
      return Boolean(
        named.masterCategoryName ||
          named.masterCategory ||
          named.subCategory ||
          named.masterCategoryId,
      );
    }
    return Boolean(product.masterCategoryName || product.masterCategoryId);
  });
}

function sliceSalesInventoryPage(list: Product[], uiPage: number) {
  const start = Math.max(0, uiPage - 1) * SALES_INVENTORY_PAGE_SIZE;
  return {
    products: list.slice(start, start + SALES_INVENTORY_PAGE_SIZE),
    hasNext: start + SALES_INVENTORY_PAGE_SIZE < list.length,
  };
}

export function localSalesInventoryPage(
  uiPage: number,
  tag: string,
  cat = "",
  subCat = "",
) {
  const catalog = catalogForAccess(loadSalesCompanyAccess());
  if (!catalog || catalog.length === 0) return null;
  if ((cat || subCat) && !catalogSupportsCategoryFilter(catalog)) return null;
  const needle = tag.trim().toLowerCase();
  if (!needle && !cat && !subCat) return sliceSalesInventoryPage(catalog, uiPage);
  const matched: Product[] = [];
  for (const row of salesCatalogRows(catalog)) {
    if (needle && !row.hay.includes(needle)) continue;
    if (cat && !row.categories.includes(cat)) continue;
    if (subCat && row.subId !== subCat && row.subName !== subCat) continue;
    matched.push(row.product);
  }
  return sliceSalesInventoryPage(matched, uiPage);
}

export async function loadSalesInventoryUiPage(
  storeId: string,
  userId: string,
  uiPage: number,
  tag: string,
  cache: SalesProductCache,
  tempStore = false,
  cat = "",
  subCat = "",
) {
  const local = localSalesInventoryPage(uiPage, tag, cat, subCat);
  if (local) return local;

  const selected = loadSelectedSalesCompany();
  if (selected?.id && !cat && !subCat) {
    try {
      const needle = tag.trim().toLowerCase();
      if (needle) {
        const stubs = await ensureCompanyStubs(selected.id);
        const matched = stubs.filter((product) =>
          [product.itemName, product.itemRef, product.barCode, product.barcode]
            .map((value) => String(value || "").toLowerCase())
            .join(" ")
            .includes(needle),
        );
        const start = Math.max(0, uiPage - 1) * SALES_INVENTORY_PAGE_SIZE;
        const slice = matched.slice(start, start + SALES_INVENTORY_PAGE_SIZE);
        return {
          products: await enrichSalesProducts(slice),
          hasNext: matched.length > start + SALES_INVENTORY_PAGE_SIZE,
        };
      }
      return prefetchCompanyInventoryPage(selected.id, uiPage);
    } catch {
      /* Store paging still covers a company endpoint failure. */
    }
  }

  const needed = uiPage * SALES_INVENTORY_PAGE_SIZE;
  const collected: Product[] = [];
  for (let apiPage = 1; apiPage <= 40; apiPage++) {
    const list = await inventoryApiPage(
      storeId,
      userId,
      tag,
      apiPage,
      cache,
      tempStore,
      cat,
      subCat,
    );
    collected.push(...list);
    const rawLength =
      pageSizeBucket(cache, productCacheKey(storeId, tag, tempStore, cat, subCat)).get(
        apiPage,
      ) ?? list.length;
    if (rawLength < SALES_INVENTORY_API_PAGE_SIZE) break;
    if (collected.length > needed) break;
  }
  const start = (uiPage - 1) * SALES_INVENTORY_PAGE_SIZE;
  return {
    products: collected.slice(start, start + SALES_INVENTORY_PAGE_SIZE),
    hasNext: collected.length > start + SALES_INVENTORY_PAGE_SIZE,
  };
}

export async function getSalesPendingOrders(userId: string) {
  const data = await request<unknown>("/sales/report/temp", {
    method: "POST",
    body: JSON.stringify({ userId, isAdmin: false }),
  });
  return Array.isArray(data) ? (data as ApprovalOrder[]) : [];
}

function namedStore(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "null" || isObjectId(text)) return "";
  return text;
}

function orderNeedsStoreName(order: ApprovalOrder) {
  if (namedStore(order.storeName)) return false;
  if (order.store && typeof order.store === "object") {
    if (namedStore(order.store.storeName) || namedStore(order.store.name)) return false;
  }
  if (namedStore(order.store)) return false;
  const id =
    typeof order.store === "string"
      ? order.store.trim()
      : String(order.store?._id || "").trim();
  return isObjectId(id);
}

function rememberStoreName(
  map: Map<string, string>,
  store: { _id?: string; storeName?: string; name?: string },
) {
  const id = String(store._id || "").trim();
  const name = namedStore(store.storeName) || namedStore(store.name);
  if (!id || !name) return;
  map.set(id, name);
  map.set(id.toLowerCase(), name);
}

function storesInPayload(data: unknown): StoreProfile[] {
  const direct = asStoreList(data);
  if (direct.length > 0) return direct;
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const lists = [o.myStoreArr, o.myStores, o.otherStore, o.otherStores, o.stores, o.data];
  return lists.flatMap((list) => asStoreList(list));
}

async function storeNamesById(userId: string, needed: Set<string>) {
  const map = new Map<string, string>();
  const found = () =>
    [...needed].every((id) => map.has(id) || map.has(id.toLowerCase()));
  for (const store of loadDownloadedStores()) rememberStoreName(map, store);
  if (found()) return map;
  try {
    for (const store of storesInPayload(await request<unknown>("/sales/store"))) {
      rememberStoreName(map, store);
    }
  } catch {
    /* paging below still fills gaps */
  }
  if (found()) return map;
  try {
    for (let page = 1; page <= 40; page++) {
      const batch = await getSalesStorePage(userId, page);
      if (page === 1) {
        for (const store of batch.myStores) rememberStoreName(map, store);
      }
      for (const store of batch.otherStores) rememberStoreName(map, store);
      if (found() || batch.otherStores.length < SALES_STORE_API_PAGE_SIZE) break;
    }
  } catch {
    return map;
  }
  return map;
}

async function withStoreNames(orders: ApprovalOrder[], userId: string) {
  const needed = new Set<string>();
  for (const order of orders) {
    if (!orderNeedsStoreName(order)) continue;
    const id =
      typeof order.store === "string"
        ? order.store.trim()
        : String(order.store?._id || "").trim();
    if (id) needed.add(id);
  }
  if (needed.size === 0) return orders;
  const names = await storeNamesById(userId, needed);
  return orders.map((order) => {
    if (!orderNeedsStoreName(order)) return order;
    const id =
      typeof order.store === "string"
        ? order.store.trim()
        : String(order.store?._id || "").trim();
    const name = names.get(id) || names.get(id.toLowerCase());
    if (!name) return order;
    return { ...order, storeName: name };
  });
}

export async function getSalesConfirmedOrders(userId: string) {
  const data = await request<unknown>("/sales/report/order", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  const orders = Array.isArray(data) ? (data as ApprovalOrder[]) : [];
  return withStoreNames(orders, userId);
}

export async function getSalesOrder(salesId: string, orderId: string) {
  const [pending, approvals, confirmed] = await Promise.all([
    getSalesPendingOrders(salesId).catch(() => [] as ApprovalOrder[]),
    getSalesApprovals(salesId).catch(() => [] as ApprovalOrder[]),
    getSalesConfirmedOrders(salesId).catch(() => [] as ApprovalOrder[]),
  ]);
  return (
    pending.find((order) => order._id === orderId) ||
    approvals.find((order) => order._id === orderId) ||
    confirmed.find((order) => order._id === orderId) ||
    null
  );
}

export function placeSalesOrderPayload({
  salesId,
  storeId,
  lines,
  discount,
  payableAmount,
  payableEdited,
  date,
  tempStore = false,
}: {
  salesId: string;
  storeId: string;
  lines: SalesCartLine[];
  discount: number;
  payableAmount: number;
  payableEdited: boolean;
  date: string;
  tempStore?: boolean;
}) {
  const { totalCost, totalQuantity } = cartTotals(lines);
  const unitPriceEdited = cartUnitPriceEdited(lines);
  const needsApproval = discount > 0 || payableEdited || unitPriceEdited;
  const masterIds = new Set<string>();
  const categoryList: { masterCategoryId: string; isDone: boolean }[] = [];
  for (const line of lines) {
    const id = line.masterCategoryId || "none";
    if (masterIds.has(id)) continue;
    masterIds.add(id);
    categoryList.push({ masterCategoryId: id, isDone: false });
  }
  return {
    invoiceType: "ld",
    salesId,
    storeId,
    productDetails: lines.map((line) => {
      const storeCost = Number(line.storeCost) || 0;
      const catalogStoreCost =
        line.catalogStoreCost == null
          ? storeCost
          : Number(line.catalogStoreCost) || 0;
      const priceChangeReq = Math.abs(storeCost - catalogStoreCost) > 0.009;
      return {
        product: line.productId,
        categoryId: line.categoryId,
        storeCost,
        catalogStoreCost,
        priceChangeReq,
        aggregateCost: lineAggregate(line),
        quantityReq: Number(line.quantityReq) || 0,
        quantityAv: Number(line.quantityReq) || 0,
        unitReq: line.unitReq,
        unitAv: line.unitReq,
      };
    }),
    categoryList,
    note: "No note",
    discount,
    isVat: true,
    totalQuantity,
    totalCost,
    date,
    isTempStore: tempStore ? "true" : "false",
    editFlag: false,
    payableAmount,
    payableEdited,
    unitPriceEdited,
    needsApproval,
  };
}

export const placeSalesOrder = (body: Record<string, unknown>) =>
  request<unknown>("/sales/tempOrder", {
    method: "POST",
    body: JSON.stringify(body),
  });

// —— GRV ——
export async function getGrvOrders() {
  const data = await request<unknown>("/admin/grv");
  const list = Array.isArray(data)
    ? (data as GrvOrder[])
    : (asWarehouseOrders(data) as GrvOrder[]);
  const seen = new Set<string>();
  return list.filter((order) => {
    const id = String(order?._id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function searchInvoiceNumbers(tag: string) {
  const data = await request<unknown>("/admin/read/search/invoiceNumber", {
    method: "POST",
    body: JSON.stringify({ tag }),
  });
  if (!Array.isArray(data)) return [] as { _id: string; invoiceNumber?: string }[];
  return data.filter((item): item is { _id: string; invoiceNumber?: string } => {
    return Boolean(item && typeof item === "object" && typeof (item as { _id?: unknown })._id === "string");
  });
}

export async function getConfirmedInvoice(
  userId: string,
  orderId: string,
): Promise<GrvOrder | null> {
  for (let page = 1; page <= 80; page++) {
    const batch = await getWarehouseOrdersPage(userId, page, 2);
    const match = batch.orders.find((order) => order._id === orderId);
    if (match) return match as GrvOrder;
    if (batch.orders.length < 50) break;
  }
  return null;
}

export async function getAllConfirmedInvoices(userId: string) {
  const result = await getAllWarehouseOrders(userId, 2);
  return result.orders as GrvOrder[];
}

export async function getInvoiceStoreDetails(userId: string, orderId: string) {
  const data = await request<unknown>("/admin/read/order/details", {
    method: "POST",
    body: JSON.stringify({ userId, orderId }),
  });
  return data as {
    sales?: { name?: string };
    store?: { storeName?: string; name?: string };
  };
}

interface OrderCategory {
  name?: string;
  masterCategoryId?: string;
  isGRV?: boolean;
  isDone?: boolean;
}

export async function getInvoiceCategories(userId: string, orderId: string) {
  const data = await request<unknown>("/warehouse/orderDetails", {
    method: "POST",
    body: JSON.stringify({ userId, orderId, orderType: "Order" }),
  });
  if (!data || typeof data !== "object") return [] as OrderCategory[];
  const list = (data as { "Category List"?: OrderCategory[] })["Category List"];
  return Array.isArray(list) ? list : [];
}

export async function getInvoiceCategoryProducts(
  userId: string,
  orderId: string,
  masterCategoryId: string,
) {
  const data = await request<unknown>("/warehouse/category/products", {
    method: "POST",
    body: JSON.stringify({
      userId,
      orderId,
      orderType: "Order",
      masterCategoryId,
    }),
  });
  if (!data || typeof data !== "object") return [] as GrvLine[];
  const list = (data as { productArr?: GrvLine[] }).productArr;
  return Array.isArray(list) ? list : [];
}

export async function getInvoiceLines(userId: string, order: GrvOrder) {
  const categories =
    Array.isArray(order.categoryList) && order.categoryList.length > 0
      ? order.categoryList
      : await getInvoiceCategories(userId, order._id);
  const lines: GrvLine[] = [];
  const seen = new Set<string>();
  for (const category of categories) {
    const masterCategoryId = String(category.masterCategoryId || "");
    if (!masterCategoryId) continue;
    try {
      const products = await getInvoiceCategoryProducts(
        userId,
        order._id,
        masterCategoryId,
      );
      for (const line of products) {
        const id = typeof line.product === "string" ? line.product : line.product?._id;
        const key = `${id || ""}:${masterCategoryId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push({
          ...line,
          product:
            typeof line.product === "object" && line.product
              ? { ...line.product, masterCategoryId }
              : line.product,
        });
      }
    } catch {
      // Category with no items is skipped; fallback below uses the raw order lines.
    }
  }
  if (lines.length > 0) return { lines, categories };
  return { lines: Array.isArray(order.productDetails) ? order.productDetails : [], categories };
}

export const saveGrvEdit = (body: {
  userId: string;
  orderId: string;
  masterCategoryId: string;
  productDetails: Record<string, unknown>[];
}) =>
  request<unknown>("/admin/grv/edit", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const toggleGrvDamaged = (
  orderId: string,
  productId: string,
  isDamaged: boolean,
) =>
  request<unknown>("/admin/grv/isDamaged", {
    method: "PUT",
    body: JSON.stringify({ orderId, productId, isDamaged }),
  });

export const updateInventoryQuantities = (
  updates: {
    itemRef: string;
    closingQty: number;
    mode?: "append" | "replace";
    sellingPrice?: number;
  }[],
) =>
  request<unknown>("/admin/product/updateQuantities", {
    method: "POST",
    body: JSON.stringify({ updates }),
  });

// —— Payments ——
function unwrapPayments(data: unknown): PaymentRecord[] {
  if (Array.isArray(data)) return data as PaymentRecord[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.payments)) return o.payments as PaymentRecord[];
    if (Array.isArray(o.payment)) return o.payment as PaymentRecord[];
  }
  return [];
}

export const getPayments = async (userId: string) => {
  const data = await request<
    PaymentRecord[] | { payments?: PaymentRecord[]; payment?: PaymentRecord[] }
  >("/admin/payment", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return unwrapPayments(data);
};

export const createPayment = (body: {
  paymentMode: string;
  date: string;
  orderId: string;
  currency: string;
  note: string;
  amountPaid: number;
  chequeNo?: number;
}) =>
  request<unknown>("/admin/payment/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const editPayment = (body: {
  paymentId: string;
  paymentMode: string;
  date: string;
  orderId: string;
  currency: string;
  note: string;
  amountPaid: number;
  chequeNo?: number;
}) =>
  request<unknown>("/admin/payment/edit", {
    method: "POST",
    body: JSON.stringify(body),
  });

export async function getPdcs(userId: string) {
  const data = await request<unknown>("/admin/pdc", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  if (Array.isArray(data)) return data as PdcRecord[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.pdcArr)) return o.pdcArr as PdcRecord[];
    if (Array.isArray(o.payment)) return o.payment as PdcRecord[];
  }
  return [] as PdcRecord[];
}

export const createPdc = (body: {
  orderId: string;
  givenDate: string;
  chequeDate: string;
  amount: number;
}) =>
  request<unknown>("/admin/pdc/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

const LIST_PAGE_SIZE = 50;

function pageItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["stores", "products", "data", "users"]) {
      if (Array.isArray(o[key])) return o[key];
    }
  }
  return [];
}

function pageFirstId(items: unknown[]): string {
  const first = items[0];
  if (!first || typeof first !== "object") return "";
  const id = (first as { _id?: unknown })._id;
  return typeof id === "string" ? id : "";
}

/** Count paged records without downloading every page. */
async function countByPaging(
  fetchPage: (page: number) => Promise<unknown>,
  pageSize = LIST_PAGE_SIZE,
  maxPages = 80,
): Promise<number> {
  const first = pageItems(await fetchPage(1));
  if (first.length === 0) return 0;
  if (first.length !== pageSize) return first.length;

  const firstId = pageFirstId(first);
  const second = pageItems(await fetchPage(2));
  if (second.length === 0) return first.length;
  if (firstId && firstId === pageFirstId(second)) return first.length;
  if (second.length < pageSize) return first.length + second.length;

  let lastFull = 2;
  let probe = 4;
  while (probe <= maxPages) {
    const items = pageItems(await fetchPage(probe));
    if (items.length === 0) break;
    if (firstId && firstId === pageFirstId(items)) break;
    if (items.length < pageSize) {
      return (probe - 1) * pageSize + items.length;
    }
    lastFull = probe;
    probe *= 2;
  }

  let left = lastFull + 1;
  let right = Math.min(probe, maxPages);
  let lastPage = lastFull;
  let lastCount = pageSize;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const items = pageItems(await fetchPage(mid));
    if (
      items.length === 0 ||
      (firstId && firstId === pageFirstId(items) && mid !== 1)
    ) {
      right = mid - 1;
      continue;
    }
    lastPage = mid;
    lastCount = items.length;
    if (items.length < pageSize) break;
    left = mid + 1;
  }

  return (lastPage - 1) * pageSize + lastCount;
}

export interface DashboardStats {
  totalUsers: number;
  totalStores: number;
  totalSalesman: number;
  totalWarehouseUsers: number;
  expiredTradeLicenses: number;
  totalInventory: number;
  pendingApprovals: number;
}

export async function loadDashboardStats(
  onUpdate: (partial: Partial<DashboardStats>) => void,
): Promise<void> {
  let salesman = 0;
  let warehouseUsers = 0;
  let adminUsers = 0;

  const pushUsers = () =>
    onUpdate({
      totalSalesman: salesman,
      totalWarehouseUsers: warehouseUsers,
      totalUsers: salesman + warehouseUsers + adminUsers,
    });

  await Promise.all([
    getSalesProfiles()
      .then((list) => {
        salesman = list.length;
        pushUsers();
      })
      .catch(() => pushUsers()),
    getWarehouseProfiles()
      .then((list) => {
        warehouseUsers = list.length;
        pushUsers();
      })
      .catch(() => pushUsers()),
    getAdminProfiles()
      .then((list) => {
        adminUsers = list.length;
        pushUsers();
      })
      .catch(() => pushUsers()),
    getExpiredTradeLicenses()
      .then((list) => onUpdate({ expiredTradeLicenses: list.length }))
      .catch(() => onUpdate({ expiredTradeLicenses: 0 })),
    countByPaging(getStores)
      .then((totalStores) => onUpdate({ totalStores }))
      .catch(() => onUpdate({ totalStores: 0 })),
    getCompanies()
      .then((companies) =>
        onUpdate({
          totalInventory: companies.reduce(
            (sum, company) => sum + (company.productCount ?? 0),
            0,
          ),
        }),
      )
      .catch(() => onUpdate({ totalInventory: 0 })),
    getApprovalQueue()
      .then((orders) =>
        onUpdate({
          pendingApprovals: orders.filter(
            (order) => order.approvalStatus === "pending",
          ).length,
        }),
      )
      .catch(() => onUpdate({ pendingApprovals: 0 })),
  ]);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats: DashboardStats = {
    totalUsers: 0,
    totalStores: 0,
    totalSalesman: 0,
    totalWarehouseUsers: 0,
    expiredTradeLicenses: 0,
    totalInventory: 0,
    pendingApprovals: 0,
  };
  await loadDashboardStats((partial) => Object.assign(stats, partial));
  return stats;
}


// —— Sales performance / leave / targets ——
export type PerformanceCompanyBlock = {
  delivered: number;
  target: number | null;
  progress: number | null;
  companyId?: string | null;
  targetSet: boolean;
};

export type SalesPerformance = {
  year: number;
  month: number;
  totalDelivered: number;
  orderCount?: number;
  stl: PerformanceCompanyBlock;
  shmp: PerformanceCompanyBlock;
};

export type LeaveRequestRow = {
  _id: string;
  sales?: { _id?: string; name?: string; email?: string } | string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  leaveType?: string;
  dayCount: number;
  decidedBy?: { name?: string } | string;
  decidedAt?: string;
  createdAt?: string;
};

export async function getSalesPerformance(userId: string) {
  return request<SalesPerformance>(
    `/sales/performance?userId=${encodeURIComponent(userId)}`,
  );
}

export async function getSalesLeave(userId: string, status?: string) {
  const qs = new URLSearchParams({ userId });
  if (status) qs.set("status", status);
  return request<{
    approvedCount: number;
    pendingCount: number;
    leaves: LeaveRequestRow[];
    balance?: {
      year: number;
      entitlements: { annual: number; sick: number };
      used: { annual: number; sick: number };
      pending: { annual: number; sick: number; count: number };
      remaining: { annual: number; sick: number };
    };
    attendanceToday?: {
      attendance: AttendanceRecord | null;
      override: unknown;
      checkedIn: boolean;
      checkedOut: boolean;
    };
  }>(`/sales/leave?${qs.toString()}`);
}

export async function applySalesLeave(payload: {
  userId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  leaveType?: "annual" | "sick";
}) {
  return request<LeaveRequestRow>("/sales/leave", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelSalesLeave(userId: string, leaveId: string) {
  return request<LeaveRequestRow>(`/sales/leave/${leaveId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function getAdminPerformance() {
  return request<{
    year: number;
    month: number;
    salesmen: Array<{
      sales: { _id: string; name?: string; email?: string };
      year: number;
      month: number;
      totalDelivered: number;
      stl: PerformanceCompanyBlock;
      shmp: PerformanceCompanyBlock;
    }>;
  }>("/admin/performance");
}

export async function setAdminSalesTarget(payload: {
  salesId: string;
  companyId: string;
  amount: number;
  userId?: string;
}) {
  return request<unknown>("/admin/performance/target", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminLeaves(params?: {
  status?: string;
  salesId?: string;
  from?: string;
  to?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.salesId) qs.set("salesId", params.salesId);
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  return request<{ leaves: LeaveRequestRow[] }>(
    `/admin/leave${q ? `?${q}` : ""}`,
  );
}

export async function decideAdminLeave(
  leaveId: string,
  decision: "approved" | "rejected",
  userId?: string,
) {
  return request<LeaveRequestRow>(`/admin/leave/${leaveId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, userId }),
  });
}

export type AttendanceRecord = {
  _id: string;
  sales?:
    | string
    | { _id?: string; name?: string; email?: string; mobileNumber?: string };
  date?: string;
  checkInAt?: string;
  checkOutAt?: string;
  checkInLocation?: { lat?: number; lng?: number };
  checkOutLocation?: { lat?: number; lng?: number };
  /** End-of-day activity report submitted at check-out. */
  report?: string;
};

export type TrackingLocation = {
  _id?: string;
  salesId?: string;
  name?: string;
  email?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt?: string;
  isActive?: boolean;
};

export async function getSalesAttendanceToday(userId: string) {
  return request<{
    attendance: AttendanceRecord | null;
    checkedIn: boolean;
    checkedOut: boolean;
  }>(`/sales/attendance/today?userId=${encodeURIComponent(userId)}`);
}

export async function salesCheckIn(payload: {
  userId: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
}) {
  return request<AttendanceRecord>(`/sales/attendance/checkin`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function salesCheckOut(payload: {
  userId: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  /** Required daily activity report before check-out. */
  report: string;
}) {
  return request<AttendanceRecord>(`/sales/attendance/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSalesLocation(payload: {
  userId: string;
  lat: number;
  lng: number;
  accuracy?: number;
}) {
  return request<unknown>(`/sales/location`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminAttendance(params: {
  userId: string;
  salesId?: string;
  from?: string;
  to?: string;
  today?: boolean;
}) {
  const qs = new URLSearchParams();
  qs.set("userId", params.userId);
  if (params.salesId) qs.set("salesId", params.salesId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.today) qs.set("today", "1");
  return request<{ attendance: AttendanceRecord[] }>(
    `/admin/attendance?${qs.toString()}`,
  );
}

export async function getAdminTrackingLocations(userId: string) {
  return request<{ locations: TrackingLocation[] }>(
    `/admin/tracking/locations?userId=${encodeURIComponent(userId)}`,
  );
}

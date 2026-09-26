import { getStoredAuth } from "./auth";
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
  WarehouseCounts,
  WarehouseCheckLine,
  WarehouseCheckOrder,
  WarehouseCheckStep,
  ApprovalOrder,
  AuthUser,
  SalesCartLine,
} from "./types";
import { asProductList, asStoreList, cartTotals, lineAggregate } from "./sales";

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
    }
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...options,
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

  return {
    id: String(data._id ?? ""),
    name: String(data.name ?? ""),
    email: String(data.email ?? email),
    role: String(data.role ?? ""),
    token,
    mobileNumber: data.mobileNumber
      ? String(data.mobileNumber)
      : undefined,
  };
}

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
export const editVehicle = (vehicleId: string, vehicleNumber: number) =>
  request<string>("/admin/vehicle/edit", {
    method: "POST",
    body: JSON.stringify({ vehicleId, vehicleNumber }),
  });
export const deleteVehicle = (vehicleId: string) =>
  request<string>("/admin/vehicle/delete", {
    method: "POST",
    body: JSON.stringify({ vehicleId }),
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
  request<unknown>(`/admin/edit/deleteUser/${id}`, { method: "DELETE" });

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

export interface CompanyProduct {
  _id: string;
  itemName?: string;
  itemRef?: string;
  company?: string;
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
  };
}

export async function getCompanyProducts(
  companyId: string,
  page = 1,
  limit = 500,
): Promise<CompanyProductsPage> {
  const data = await request<unknown>("/admin/company/products", {
    method: "POST",
    body: JSON.stringify({ companyId, page, limit }),
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
export const searchProducts = (tag: string) =>
  request<Product[]>("/admin/product/search", {
    method: "POST",
    body: JSON.stringify({ tag }),
  });
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
export const updateProduct = (data: Record<string, unknown>) =>
  request<unknown>("/admin/product/update", {
    method: "PUT",
    body: JSON.stringify(data),
  });
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
export const getPendingOrders = (userId: string, page = 1, tabIndex = 0) =>
  request<PendingOrder[] | { orders?: PendingOrder[]; data?: PendingOrder[] }>(
    `/mock/warehouse/order/pending?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
  );

export type WarehouseTabIndex = 0 | 1 | 2;

export interface WarehouseOrdersResult {
  orders: PendingOrder[];
  counts?: WarehouseCounts;
}

function asWarehouseOrders(data: unknown): PendingOrder[] {
  if (Array.isArray(data)) return data as PendingOrder[];
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  for (const key of [
    "orderArr",
    "orders",
    "data",
    "tempOder",
    "tempOrder",
    "order",
    "results",
  ]) {
    if (Array.isArray(o[key])) return o[key] as PendingOrder[];
  }
  return [];
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
    totalPkgCount: Number(o.totalPkgCount) || 0,
  };
}

export async function getWarehouseOrdersPage(
  userId: string,
  page: number,
  tabIndex: WarehouseTabIndex,
): Promise<WarehouseOrdersResult> {
  const kind = tabIndex === 2 ? "confirmed" : "pending";
  const data = await request<unknown>(
    `/mock/warehouse/order/${kind}?userId=${encodeURIComponent(userId)}&page=${page}&tabIndex=${tabIndex}`,
  );
  return {
    orders: asWarehouseOrders(data).filter((order) => !order.isDraft),
    counts: asWarehouseCounts(data),
  };
}

export async function searchWarehouseOrdersPage(
  userId: string,
  tag: string,
  page: number,
  tabIndex: WarehouseTabIndex,
): Promise<PendingOrder[]> {
  const orderType = tabIndex === 2 ? "confirm" : "temp";
  const data = await request<unknown>(
    `/mock/warehouse/search?tag=${encodeURIComponent(tag)}&userId=${encodeURIComponent(userId)}&orderType=${orderType}&tabIndex=${tabIndex}&page=${page}`,
  );
  return asWarehouseOrders(data).filter((order) => !order.isDraft);
}

export async function getAllWarehouseOrders(
  userId: string,
  tabIndex: WarehouseTabIndex,
  tag = "",
): Promise<WarehouseOrdersResult> {
  const pageSize = tabIndex === 0 ? 100 : 50;
  const orders: PendingOrder[] = [];
  const seen = new Set<string>();
  let counts: WarehouseCounts | undefined;
  const query = tag.trim();

  for (let page = 1; page <= 80; page++) {
    const batch = query
      ? {
          orders: await searchWarehouseOrdersPage(userId, query, page, tabIndex),
          counts: undefined,
        }
      : await getWarehouseOrdersPage(userId, page, tabIndex);
    if (batch.counts && !counts) counts = batch.counts;

    let added = 0;
    for (const order of batch.orders) {
      const id = String(order._id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orders.push(order);
      added += 1;
    }

    // Stop on a short page, a full unpaged dump, or a page that only repeats ids.
    if (
      batch.orders.length < pageSize ||
      batch.orders.length > pageSize ||
      added === 0
    ) {
      break;
    }
  }

  return { orders, counts };
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
) =>
  request<unknown>(`/mock/warehouse/confirm/${checkNo}`, {
    method: "PUT",
    body: JSON.stringify({
      orderId,
      userId,
      productDetails: checkLinePayload(lines),
    }),
  });

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

function warehouseLineProductId(line: WarehouseCheckLine) {
  if (typeof line.product === "string") return line.product;
  return line.product?._id || "";
}

export const exportTempOrders = (orderId: string[], userId: string) =>
  request<unknown>("/admin/export/tempOrder", {
    method: "POST",
    body: JSON.stringify({ orderId, userId }),
  });

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

export async function getSalesStorePage(userId: string, page = 1): Promise<SalesStorePage> {
  const data = await request<unknown>("/sales/store", {
    method: "POST",
    body: JSON.stringify({ userId, page }),
  });
  if (!data || typeof data !== "object") {
    return { myStores: [], otherStores: [] };
  }
  const o = data as Record<string, unknown>;
  return {
    myStores: asStoreList(o.myStoreArr ?? o.myStores),
    otherStores: asStoreList(o.otherStore ?? o.otherStores),
  };
}

export async function getAllSalesStores(userId: string) {
  const myStores: StoreProfile[] = [];
  const otherStores: StoreProfile[] = [];
  for (let page = 1; page <= 80; page++) {
    const batch = await getSalesStorePage(userId, page);
    if (page === 1) myStores.push(...batch.myStores);
    otherStores.push(...batch.otherStores);
    if (batch.otherStores.length < 50) break;
  }
  return { myStores, otherStores };
}

export const downloadSalesStores = () => request<StoreProfile[]>("/sales/store");

export async function downloadSalesCatalog(salesId: string) {
  const query = `salesId=${encodeURIComponent(salesId)}`;
  const live = asProductList(
    await request<unknown>(`/sales/product?${query}`),
  );
  if (live.length > 0) return live;
  return asProductList(
    await request<unknown>(`/mock/sales/product?${query}`),
  );
}

export async function getStoreProducts(
  storeId: string,
  userId: string,
  page = 1,
  tempStore = false,
) {
  const data = await request<unknown>("/sales/products", {
    method: "POST",
    body: JSON.stringify({
      storeId,
      userId,
      page,
      tempStore: tempStore ? "true" : "false",
    }),
  });
  return asProductList(data);
}

export async function getSalesPendingOrders(userId: string) {
  const data = await request<unknown>("/sales/report/temp", {
    method: "POST",
    body: JSON.stringify({ userId, isAdmin: false }),
  });
  return Array.isArray(data) ? (data as ApprovalOrder[]) : [];
}

export async function getSalesConfirmedOrders(userId: string) {
  const data = await request<unknown>("/sales/report/order", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return Array.isArray(data) ? (data as ApprovalOrder[]) : [];
}

export async function getSalesOrder(salesId: string, orderId: string) {
  const [pending, approvals] = await Promise.all([
    getSalesPendingOrders(salesId).catch(() => [] as ApprovalOrder[]),
    getSalesApprovals(salesId).catch(() => [] as ApprovalOrder[]),
  ]);
  return (
    pending.find((order) => order._id === orderId) ||
    approvals.find((order) => order._id === orderId) ||
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
}: {
  salesId: string;
  storeId: string;
  lines: SalesCartLine[];
  discount: number;
  payableAmount: number;
  payableEdited: boolean;
  date: string;
}) {
  const { totalCost, totalQuantity } = cartTotals(lines);
  const needsApproval = discount > 0 || payableEdited;
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
    productDetails: lines.map((line) => ({
      product: line.productId,
      categoryId: line.categoryId,
      storeCost: Number(line.storeCost) || 0,
      aggregateCost: lineAggregate(line),
      quantityReq: Number(line.quantityReq) || 0,
      quantityAv: Number(line.quantityReq) || 0,
      unitReq: line.unitReq,
      unitAv: line.unitReq,
    })),
    categoryList,
    note: "No note",
    discount,
    isVat: true,
    totalQuantity,
    totalCost,
    date,
    isTempStore: "false",
    editFlag: false,
    payableAmount,
    payableEdited,
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
  updates: { itemRef: string; closingQty: number }[],
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

function summarizePayments(payments: PaymentRecord[]): {
  paymentReceived: number;
  receivable: number;
} {
  const byOrder = new Map<string, { paid: number; total: number }>();
  let paymentReceived = 0;

  for (const payment of payments) {
    const paid = Number(payment.amountPaid) || 0;
    const balance = Number(payment.balance) || 0;
    paymentReceived += paid;

    const order = payment.order;
    const orderId =
      typeof order === "string"
        ? order
        : String(order?._id ?? payment._id);
    const orderTotal =
      typeof order === "object" && typeof order?.totalCost === "number"
        ? order.totalCost
        : paid + balance;

    const existing = byOrder.get(orderId);
    if (existing) {
      existing.paid += paid;
      if (orderTotal > existing.total) existing.total = orderTotal;
    } else {
      byOrder.set(orderId, { paid, total: orderTotal });
    }
  }

  let receivable = 0;
  for (const { paid, total } of byOrder.values()) {
    receivable += Math.max(0, total - paid);
  }

  return { paymentReceived, receivable };
}

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
  paymentReceived: number;
  receivable: number;
  pendingApprovals: number;
}

export async function loadDashboardStats(
  onUpdate: (partial: Partial<DashboardStats>) => void,
): Promise<void> {
  const userId = getStoredAuth()?.id ?? "";
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
    countByPaging((page) => getProducts(page))
      .then((totalInventory) => onUpdate({ totalInventory }))
      .catch(() => onUpdate({ totalInventory: 0 })),
    (userId ? getPayments(userId) : Promise.resolve([] as PaymentRecord[]))
      .then((payments) => onUpdate(summarizePayments(payments)))
      .catch(() => onUpdate({ paymentReceived: 0, receivable: 0 })),
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
    paymentReceived: 0,
    receivable: 0,
    pendingApprovals: 0,
  };
  await loadDashboardStats((partial) => Object.assign(stats, partial));
  return stats;
}

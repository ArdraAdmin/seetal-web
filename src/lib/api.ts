import { getStoredAuth } from "./auth";
import type {
  Driver,
  GrvOrder,
  PaymentRecord,
  PendingOrder,
  Product,
  ProfileUser,
  StoreProfile,
  Vehicle,
  WarehouseCounts,
  ApprovalOrder,
  AuthUser,
} from "./types";

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
  if (!headers.has("Content-Type") && options.body) {
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
export const updateProduct = (data: Record<string, unknown>) =>
  request<unknown>("/admin/product/update", {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const getCategories = () => request<unknown>("/admin/category");
export const getMasterCategories = () =>
  request<unknown>("/admin/category/master");

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
  let counts: WarehouseCounts | undefined;
  const query = tag.trim();

  for (let page = 1; page <= 80; page++) {
    if (query) {
      const list = await searchWarehouseOrdersPage(
        userId,
        query,
        page,
        tabIndex,
      );
      orders.push(...list);
      if (list.length < pageSize) break;
    } else {
      const batch = await getWarehouseOrdersPage(userId, page, tabIndex);
      if (batch.counts && !counts) counts = batch.counts;
      orders.push(...batch.orders);
      if (batch.orders.length < pageSize) break;
    }
  }

  return { orders, counts };
}

export const exportTempOrders = (orderId: string[], userId: string) =>
  request<unknown>("/admin/export/tempOrder", {
    method: "POST",
    body: JSON.stringify({ orderId, userId }),
  });

// —— Approvals ——
function asApprovalOrders(data: unknown): ApprovalOrder[] {
  if (Array.isArray(data)) return data as ApprovalOrder[];
  return [];
}

export const getApprovalQueue = async () =>
  asApprovalOrders(await request<unknown>("/mock/sales/approvalQueue"));

export const getSalesApprovals = async (salesId: string) =>
  asApprovalOrders(
    await request<unknown>(
      `/mock/sales/approvals?salesId=${encodeURIComponent(salesId)}`,
    ),
  );

export const decideApproval = (
  orderId: string,
  approved: boolean,
  rejectNote = "",
) =>
  request<unknown>("/mock/sales/approvalDecide", {
    method: "POST",
    body: JSON.stringify({ orderId, approved, rejectNote }),
  });

export const placeApprovedOrder = (tempOrderId: string, salesId: string) =>
  request<unknown>("/mock/sales/placeApprovedOrder", {
    method: "POST",
    body: JSON.stringify({ tempOrderId, salesId }),
  });

export const resubmitApprovalOrder = (body: Record<string, unknown>) =>
  request<unknown>("/mock/sales/tempOrder", {
    method: "POST",
    body: JSON.stringify(body),
  });

// —— GRV ——
export const getGrvOrders = () => request<GrvOrder[]>("/admin/grv");

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

async function countByPaging(
  fetchPage: (page: number) => Promise<unknown>,
): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 40; page++) {
    const data = await fetchPage(page);
    const n = Array.isArray(data) ? data.length : 0;
    total += n;
    if (n < LIST_PAGE_SIZE) break;
  }
  return total;
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

export async function getDashboardStats(): Promise<DashboardStats> {
  const userId = getStoredAuth()?.id ?? "";
  const [sales, warehouse, admins, expired, stores, products, payments, approvals] =
    await Promise.all([
      getSalesProfiles().catch(() => [] as ProfileUser[]),
      getWarehouseProfiles().catch(() => [] as ProfileUser[]),
      getAdminProfiles().catch(() => [] as ProfileUser[]),
      getExpiredTradeLicenses().catch(() => [] as StoreProfile[]),
      countByPaging(getStores).catch(() => 0),
      countByPaging((page) => getProducts(page)).catch(() => 0),
      userId
        ? getPayments(userId).catch(() => [] as PaymentRecord[])
        : Promise.resolve([] as PaymentRecord[]),
      getApprovalQueue().catch(() => [] as ApprovalOrder[]),
    ]);

  const { paymentReceived, receivable } = summarizePayments(payments);

  return {
    totalUsers: sales.length + warehouse.length + admins.length,
    totalStores: stores,
    totalSalesman: sales.length,
    totalWarehouseUsers: warehouse.length,
    expiredTradeLicenses: expired.length,
    totalInventory: products,
    paymentReceived,
    receivable,
    pendingApprovals: approvals.filter(
      (order) => order.approvalStatus === "pending",
    ).length,
  };
}

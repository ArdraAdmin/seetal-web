import { getStoredAuth } from "./auth";

const API_BASE =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE ||
      "https://stl-api-testing.herokuapp.com"
    : "/stl-api";

async function shmpRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const user = getStoredAuth();
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string>),
  };
  if (isFormData) {
    delete headers["Content-Type"];
  }
  if (user?.token) {
    headers.Authorization = user.token;
    headers["auth-token"] = user.token;
  }
  const res = await fetch(`${API_BASE}/shmp${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export type ShmpStaffCounts = {
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  half_day: number;
};

export type ShmpCategoryValue = {
  _id?: string | null;
  categoryName?: string;
  value?: number;
  qty?: number;
};

export type ShmpDashboardSummary = {
  from?: string;
  to?: string;
  totalSalesValue?: number;
  totalDeliveryValue?: number;
  totalReadyQty?: number;
  staff?: ShmpStaffCounts;
  staffToday?: ShmpStaffCounts;
  staffMtd?: ShmpStaffCounts;
  salesValueByCategory?: ShmpCategoryValue[];
  deliveryValueByCategory?: ShmpCategoryValue[];
  productionReady?: Array<{
    orderId?: string;
    invoiceNo?: string;
    productId?: string;
    productName?: string | null;
    itemRef?: string | null;
    produced?: number;
    delivered?: number;
    ready?: number;
  }>;
  productionTotals?: { produced?: number; packaged?: number };
};

export const shmpDashboard = (params?: {
  companyId?: string;
  from?: string;
  to?: string;
  signal?: AbortSignal;
}) => {
  const q = new URLSearchParams();
  if (params?.companyId) q.set("companyId", params.companyId);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const qs = q.toString();
  return shmpRequest<ShmpDashboardSummary>(
    `/dashboard/summary${qs ? `?${qs}` : ""}`,
    params?.signal ? { signal: params.signal } : {},
  );
};

export const shmpEmployees = (companyId?: string) =>
  shmpRequest<unknown[]>(
    `/employees${companyId ? `?companyId=${companyId}` : ""}`,
  );

export const shmpEmployee = (id: string) =>
  shmpRequest<unknown>(`/employees/${id}`);

export const shmpCreateEmployee = (body: Record<string, unknown>) =>
  shmpRequest("/employees", { method: "POST", body: JSON.stringify(body) });

export const shmpUpdateEmployee = (
  id: string,
  body: Record<string, unknown>,
) =>
  shmpRequest(`/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** Soft-remove a worker (list endpoints filter isActive !== false). */
export const shmpDeactivateEmployee = (id: string) =>
  shmpUpdateEmployee(id, { isActive: false });

export const shmpEmployeeLeaveBalance = (id: string, year?: number) =>
  shmpRequest<Record<string, unknown>>(
    `/employees/${id}/leave-balance${year ? `?year=${year}` : ""}`,
  );

export const shmpSetLeaveEntitlement = (
  id: string,
  body: {
    annualLeaveEntitlement?: number;
    sickLeaveEntitlement?: number;
    year?: number;
  },
) =>
  shmpRequest(`/employees/${id}/leave-entitlement`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const shmpShifts = (companyId?: string) =>
  shmpRequest<unknown[]>(
    `/shifts${companyId ? `?companyId=${companyId}` : ""}`,
  );

export const shmpCreateShift = (body: Record<string, unknown>) =>
  shmpRequest("/shifts", { method: "POST", body: JSON.stringify(body) });

export const shmpOpenShift = (body: {
  companyId: string;
  shiftId: string;
  date: string;
}) =>
  shmpRequest("/shifts/instances/open", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpCloseShift = (id: string) =>
  shmpRequest(`/shifts/instances/${id}/close`, { method: "POST", body: "{}" });

export type ShmpAttendanceRow = {
  _id?: string;
  status?: string;
  date?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  leaveType?: string;
  source?: string;
  employee?: { _id?: string; name?: string; designation?: string } | string;
  user?: { _id?: string; name?: string; role?: string } | string;
};

export const shmpAttendance = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest<ShmpAttendanceRow[]>(`/attendance?${q}`);
};

export const shmpPresentStaff = (params: {
  companyId?: string;
  date?: string;
  shiftId?: string;
}) => {
  const q = new URLSearchParams();
  if (params.companyId) q.set("companyId", params.companyId);
  if (params.date) q.set("date", params.date);
  if (params.shiftId) q.set("shiftId", params.shiftId);
  return shmpRequest(`/attendance/present?${q}`);
};

export type ShmpPresentTodayRow = {
  kind: "worker" | "portal";
  _id: string;
  name: string;
  role: string;
  designation?: string;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  source?: string;
};

/** Present workers + Sales/Supervisor check-ins for today (admins excluded). */
export const shmpPresentToday = (params?: { companyId?: string; date?: string }) => {
  const q = new URLSearchParams();
  if (params?.companyId) q.set("companyId", params.companyId);
  if (params?.date) q.set("date", params.date);
  const qs = q.toString();
  return shmpRequest<ShmpPresentTodayRow[]>(
    `/attendance/present-today${qs ? `?${qs}` : ""}`,
  );
};

export const shmpImportAttendance = (body: Record<string, unknown>) =>
  shmpRequest("/attendance/import", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpOverrideAttendance = (body: Record<string, unknown>) =>
  shmpRequest("/attendance/override", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpProductionDashboard = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/production/dashboard?${q}`);
};

export const shmpProductionEntries = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/production/entries?${q}`);
};

export const shmpCreateProductionEntry = (body: Record<string, unknown>) =>
  shmpRequest("/production/entries", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpSubmitProductionEntry = (id: string) =>
  shmpRequest(`/production/entries/${id}/submit`, {
    method: "POST",
    body: "{}",
  });

export const shmpRmMaterials = (companyId?: string) =>
  shmpRequest(
    `/rm/materials${companyId ? `?companyId=${companyId}` : ""}`,
  );

export const shmpCreateMaterial = (body: Record<string, unknown>) =>
  shmpRequest("/rm/materials", { method: "POST", body: JSON.stringify(body) });

export const shmpStockIn = (body: Record<string, unknown>) =>
  shmpRequest("/rm/stock-in", { method: "POST", body: JSON.stringify(body) });

export const shmpIssueRm = (body: Record<string, unknown>) =>
  shmpRequest("/rm/issue", { method: "POST", body: JSON.stringify(body) });

export const shmpBom = (productId: string) =>
  shmpRequest(`/rm/bom/${productId}`);

export const shmpSaveBom = (body: Record<string, unknown>) =>
  shmpRequest("/rm/bom", { method: "POST", body: JSON.stringify(body) });

export const shmpExpectedRm = (orderId: string) =>
  shmpRequest(`/rm/expected/${orderId}`);

export type ShmpOrderProgress = {
  totalItems?: number;
  doneItems?: number;
  progressPct?: number;
  ordered?: number;
  completed?: number;
  remaining?: number;
};

export const shmpOrders = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/orders?${q}`);
};

export const shmpOrderDetail = (id: string) => shmpRequest(`/orders/${id}`);

export const shmpSendToProduction = (id: string) =>
  shmpRequest(`/orders/${id}/send-to-production`, {
    method: "POST",
    body: "{}",
  });

export const shmpStartOrder = (id: string) =>
  shmpRequest(`/orders/${id}/start`, {
    method: "POST",
    body: "{}",
  });

export const shmpAssignOrderItem = (
  orderId: string,
  productId: string,
  body: {
    workers: Array<{
      employeeId: string;
      cartonQty: number;
      designation?: string;
    }>;
    shiftId?: string;
    companyId?: string;
  },
) =>
  shmpRequest(`/orders/${orderId}/items/${productId}/assign`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpMarkOrderItemDone = (orderId: string, productId: string) =>
  shmpRequest(`/orders/${orderId}/items/${productId}/done`, {
    method: "POST",
    body: "{}",
  });

/** Admin-only: set completed quantities on order lines. */
export const shmpSetCompletedQty = (
  id: string,
  lines: Array<{ productId: string; completedQty: number }>,
) =>
  shmpRequest(`/orders/${id}/completed-qty`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });

export type ShmpProductionDashboard = {
  byDay?: unknown[];
  pendingOrdersCount?: number;
  pendingOrders?: unknown[];
  todayCartons?: number;
  todayValue?: number;
  byWorker?: Array<{
    worker?: { _id?: string | null; name?: string };
    company?: { _id?: string; name?: string } | null;
    order?: { _id?: string; invoiceNo?: string } | null;
    item?: { _id?: string; name?: string; itemRef?: string } | null;
    cartonQty?: number;
    value?: number;
  }>;
};

export const shmpProductionLogs = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest<{
    date?: string;
    todayCartons?: number;
    todayValue?: number;
    logs?: ShmpProductionDashboard["byWorker"];
  }>(`/production/logs?${q}`);
};
export const shmpDeliveries = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/deliveries?${q}`);
};

export const shmpCreateDelivery = (body: Record<string, unknown>) =>
  shmpRequest("/deliveries", { method: "POST", body: JSON.stringify(body) });

export const shmpDailyDeliveryReport = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/deliveries/report/daily?${q}`);
};

export const shmpCostProducts = (companyId?: string) =>
  shmpRequest(
    `/costing/products${companyId ? `?companyId=${companyId}` : ""}`,
  );

export const shmpComputeCost = (productId: string) =>
  shmpRequest(`/costing/compute/${productId}`);

export const shmpSnapshotCost = (productId: string, companyId?: string) =>
  shmpRequest(`/costing/snapshot/${productId}`, {
    method: "POST",
    body: JSON.stringify({ companyId }),
  });

export const shmpReports = () => shmpRequest("/reports");

export const shmpReportRecipients = () => shmpRequest("/reports/recipients");

export const shmpSaveRecipients = (body: Record<string, unknown>) =>
  shmpRequest("/reports/recipients", {
    method: "PUT",
    body: JSON.stringify(body),
  });

/** Current SHMP access profile (environments + HR company scope). */
export const shmpAccessMe = () =>
  shmpRequest<Record<string, unknown>>("/access/me");

export type ShmpAccessRole = "Admin" | "Sales" | "Supervisor";

export type ShmpAccessUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: ShmpAccessRole | string;
  mobileNumber?: string;
  environments?: string[];
};

export const shmpAccessUsers = (role?: ShmpAccessRole) =>
  shmpRequest<ShmpAccessUser[]>(
    `/access/users${role ? `?role=${encodeURIComponent(role)}` : ""}`,
  );

export const shmpAccessUser = (id: string) =>
  shmpRequest<ShmpAccessUser>(`/access/users/${id}`);

export const shmpCreateAccessUser = (body: {
  role: ShmpAccessRole;
  name: string;
  email: string;
  password: string;
  mobileNumber?: string;
  environments?: string[];
  company?: string[];
  companyIds?: string[];
}) =>
  shmpRequest<ShmpAccessUser>("/access/users", {
    method: "POST",
    body: JSON.stringify(body),
  });

export type ShmpWorkerShift = "morning" | "night";

/** Create a factory worker (Employee, no login). */
export const shmpCreateAccessWorker = (body: {
  name: string;
  company: string;
  designation?: string;
  defaultShift?: ShmpWorkerShift;
  biometricId?: string;
  mobileNumber?: string;
  email?: string;
  annualLeaveEntitlement?: number;
  sickLeaveEntitlement?: number;
  visa?: { expiry?: string; yearsWorked?: number; number?: string };
}) =>
  shmpRequest("/access/workers", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpUpdateAccessUser = (
  id: string,
  body: Record<string, unknown>,
) =>
  shmpRequest<ShmpAccessUser>(`/access/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export type ShmpStorePerson = {
  _id: string;
  name?: string;
  email?: string;
};

export type ShmpStore = {
  _id: string;
  uid?: string;
  storeName?: string;
  alias?: string;
  marks?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  country?: string;
  contactNumber?: string;
  trnNo?: number | string;
  tradeLicenseExpiry?: string;
  trnDocumentKey?: string;
  tradeLicenseDocumentKey?: string;
  trnDocumentUrl?: string;
  tradeLicenseDocumentUrl?: string;
  salesPerson?: string | ShmpStorePerson;
  salesPersons?: Array<string | ShmpStorePerson>;
  environment?: string;
};

export type ShmpStoreWriteInput = {
  storeName: string;
  marks?: string;
  alias?: string;
  contactNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  country: string;
  uid: string;
  trnNo?: string | number;
  salesPersons: string[];
  salesPerson?: string;
  location?: string;
  tradeLicenseExpiry?: string;
  trnDocument?: File | null;
  tradeLicenseDocument?: File | null;
};

function appendStoreFormData(body: ShmpStoreWriteInput) {
  const fd = new FormData();
  const scalarKeys: Array<keyof ShmpStoreWriteInput> = [
    "storeName",
    "marks",
    "alias",
    "contactNumber",
    "addressLine1",
    "addressLine2",
    "addressLine3",
    "city",
    "country",
    "uid",
    "trnNo",
    "location",
    "tradeLicenseExpiry",
    "salesPerson",
  ];
  for (const key of scalarKeys) {
    const value = body[key];
    if (value == null || value === "") continue;
    fd.append(key, String(value));
  }
  fd.append("salesPersons", JSON.stringify(body.salesPersons || []));
  if (body.trnDocument) fd.append("trnDocument", body.trnDocument);
  if (body.tradeLicenseDocument) {
    fd.append("tradeLicenseDocument", body.tradeLicenseDocument);
  }
  return fd;
}

export const shmpStores = () => shmpRequest<ShmpStore[]>("/stores");

export const shmpStore = (id: string) => shmpRequest<ShmpStore>(`/stores/${id}`);

export const shmpStoreSalesmen = () =>
  shmpRequest<ShmpStorePerson[]>("/stores/meta/salesmen");

export const shmpStoreDocumentUrl = (
  id: string,
  kind: "trn" | "tradeLicense",
) =>
  shmpRequest<{ kind: string; key: string; url: string }>(
    `/stores/${id}/documents/${kind}`,
  );
export type ShmpStoreCatalogueRow = {
  productId: string;
  itemRef?: string;
  baseItemCode?: string;
  itemCode?: string;
  itemName?: string;
  sellingPrice?: number;
  company?: string | { _id?: string; name?: string; prefix?: string };
  assigned: boolean;
  storePrice: number;
  isDisplayed: boolean;
  storeItemCode?: string;
};

export const shmpStoreCatalogue = (
  storeId: string,
  params?: Record<string, string>,
) => {
  const q = new URLSearchParams(params || {});
  const qs = q.toString();
  return shmpRequest<{
    store: ShmpStore;
    products: ShmpStoreCatalogueRow[];
  }>(`/stores/${storeId}/catalogue${qs ? `?${qs}` : ""}`);
};

function storeBodyHasFiles(body: unknown): body is ShmpStoreWriteInput {
  if (!body || typeof body !== "object") return false;
  const row = body as ShmpStoreWriteInput;
  return (
    row.trnDocument instanceof File ||
    row.tradeLicenseDocument instanceof File
  );
}

export const shmpCreateStore = (body: ShmpStoreWriteInput | Record<string, unknown>) => {
  if (storeBodyHasFiles(body)) {
    return shmpRequest<ShmpStore>("/stores", {
      method: "POST",
      body: appendStoreFormData(body),
    });
  }
  return shmpRequest<ShmpStore>("/stores", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const shmpUpdateStore = (
  id: string,
  body: ShmpStoreWriteInput | Record<string, unknown>,
) => {
  if (storeBodyHasFiles(body)) {
    return shmpRequest<ShmpStore>(`/stores/${id}`, {
      method: "PUT",
      body: appendStoreFormData(body),
    });
  }
  return shmpRequest<ShmpStore>(`/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
};
export const shmpDeleteStore = (id: string) =>
  shmpRequest<{ ok: boolean; _id: string }>(`/stores/${id}`, {
    method: "DELETE",
  });

export type ShmpStoreProfile = {
  store?: string | { _id?: string; storeName?: string; uid?: string; city?: string };
  storePrice?: number;
  storeItemCode?: string;
  storeImagePath?: string;
  isDisplayed?: boolean;
};

export const SHMP_OWN_SOURCE = "shmp-production";
const SHMP_OWN_IDS_KEY = "shmp_own_inventory_ids";

export type ShmpInventoryProduct = {
  _id: string;
  itemRef?: string;
  baseItemCode?: string;
  itemCode?: string;
  itemName?: string;
  barCode?: string;
  barcode?: string;
  unit?: string;
  ratio?: number;
  sellingPrice?: number;
  isDisplay?: boolean;
  description?: string;
  dimensions?: string;
  weight?: number;
  masterCategoryId?: string;
  category?: string | { _id?: string; subCategory?: string };
  company?: string | { _id?: string; name?: string; prefix?: string };
  imagePath?: string;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
  storeProfileList?: ShmpStoreProfile[];
  source?: string;
  ownInventory?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function loadOwnShmpInventoryIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(SHMP_OWN_IDS_KEY) || "[]");
    return new Set(
      Array.isArray(raw) ? raw.map((id) => String(id || "")).filter(Boolean) : [],
    );
  } catch {
    return new Set();
  }
}

export function rememberOwnShmpInventoryId(id: string) {
  const trimmed = String(id || "").trim();
  if (!trimmed || typeof window === "undefined") return;
  const ids = loadOwnShmpInventoryIds();
  ids.add(trimmed);
  localStorage.setItem(SHMP_OWN_IDS_KEY, JSON.stringify([...ids]));
}

/** Existing STL/SHMP selling catalogue is not production inventory. */
export function isFreshShmpInventory(
  product: {
    _id?: string;
    productId?: string;
    source?: unknown;
    ownInventory?: unknown;
  },
  ownIds: Set<string> = loadOwnShmpInventoryIds(),
) {
  const id = String(product._id || product.productId || "");
  if (id && ownIds.has(id)) return true;
  if (product.ownInventory === true) return true;
  return String(product.source ?? "") === SHMP_OWN_SOURCE;
}

function normalizeCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** STL selling-company labels. SHMP production keeps its own catalogue. */
export function isStlCompanyLabel(
  company?: string | { name?: string; prefix?: string } | null,
) {
  if (!company || typeof company === "string") return false;
  const hay = normalizeCompanyKey(
    `${company.name ?? ""} ${company.prefix ?? ""}`,
  );
  if (!hay) return false;
  return hay === "stl" || (hay.includes("stl") && !hay.includes("shmp"));
}

export function baseItemCodeOf(product: {
  baseItemCode?: unknown;
  itemCode?: unknown;
}): string {
  return String(product.baseItemCode ?? product.itemCode ?? "").trim();
}

export type ShmpStoreProfileInput = {
  storeId: string;
  storePrice?: number;
  storeItemCode?: string;
  isDisplayed?: boolean;
};

export const shmpInventory = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  const qs = q.toString();
  return shmpRequest<ShmpInventoryProduct[]>(
    `/inventory${qs ? `?${qs}` : ""}`,
  );
};

export const shmpInventoryProduct = (id: string) =>
  shmpRequest<ShmpInventoryProduct>(`/inventory/${id}`);

export const shmpCreateInventory = (body: Record<string, unknown>) =>
  shmpRequest<ShmpInventoryProduct>("/inventory", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpUpdateInventory = (
  id: string,
  body: Record<string, unknown>,
) =>
  shmpRequest<ShmpInventoryProduct>(`/inventory/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const shmpDeleteInventory = (id: string) =>
  shmpRequest<{ ok: boolean; _id: string }>(`/inventory/${id}`, {
    method: "DELETE",
  });

export const shmpUpsertStoreProfile = (
  productId: string,
  body: {
    storeId: string;
    storePrice?: number;
    storeItemCode?: string;
    isDisplayed?: boolean;
  },
) =>
  shmpRequest<ShmpInventoryProduct>(`/inventory/${productId}/store-profile`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const shmpRemoveStoreProfile = (productId: string, storeId: string) =>
  shmpRequest<{ ok: boolean }>(
    `/inventory/${productId}/store-profile/${storeId}`,
    { method: "DELETE" },
  );

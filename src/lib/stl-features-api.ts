import { getStoredAuth } from "./auth";

const REMOTE_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function apiBase(): string {
  return typeof window === "undefined" ? REMOTE_API_BASE : "/stl-api";
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    cache: "no-store",
    headers,
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : text || res.statusText;
    throw new ApiError(msg || "Request failed", res.status);
  }
  return body as T;
}

export type CompanyKey = "stl" | "shmp";

export type SalesAccountDashboard = {
  now: { date: string; time: string; timezone: string; iso: string };
  companyId: string | null;
  companyKey: string | null;
  attendance: {
    status: string;
    checkedIn: boolean;
    checkedOut: boolean;
    attendance: unknown;
    override: unknown;
  };
  leave: {
    year: number;
    entitlements: { annual: number; sick: number };
    used: { annual: number; sick: number };
    pending: { annual: number; sick: number; count: number };
    remaining: { annual: number; sick: number };
  };
  performance: {
    year: number;
    month: number;
    totalDelivered: number;
    stl: { delivered: number; target: number | null; progress: number | null };
    shmp: { delivered: number; target: number | null; progress: number | null };
  };
  topProduct: {
    name: string;
    itemCode?: string;
    revenue: number;
    qty: number;
  } | null;
  topCustomer: {
    name: string;
    address?: string;
    value: number;
    orders: number;
  } | null;
  categoryDistribution: Array<{
    categoryId: string | null;
    name: string;
    revenue: number;
  }>;
};

export type VisaExpiryPerson = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  source?: "employee" | "user" | "staff" | string;
  scope?: "stl" | "shmp" | string;
  expiryDate?: string;
};

export type ExpiryAlertBucket = {
  count: number;
  employees: VisaExpiryPerson[];
  users: VisaExpiryPerson[];
  staff?: VisaExpiryPerson[];
};

export type AdminKpiDashboard = {
  now: { date: string; time: string; timezone: string };
  companyKey: string | null;
  companyId: string | null;
  topSalesman: {
    salesId: string;
    name?: string;
    email?: string;
    delivered: number;
    target: number | null;
    progress: number | null;
  } | null;
  topProducts: Array<{
    productId: string;
    name: string;
    itemCode?: string;
    revenue: number;
    qty: number;
  }>;
  salesmanGraph: Array<{
    salesId: string;
    name: string;
    delivered: number;
    target: number | null;
    stl: number;
    shmp: number;
  }>;
  monthlySales: {
    current: { year: number; month: number; total: number };
    previous: { year: number; month: number; total: number };
    delta: number;
    deltaPct: number | null;
  };
  users: {
    total: number;
    salesmen: number;
    warehouse: number;
    admins: number;
    supervisors: number;
  };
  inventoryValue: number;
  salesLost: {
    totalLost: number;
    lineCount: number;
    year: number;
    month: number;
  };
  visaExpiry: ExpiryAlertBucket;
  passportExpiry?: ExpiryAlertBucket;
  eidExpiry?: ExpiryAlertBucket;
  insuranceExpiry?: ExpiryAlertBucket;
  sharjahPermitExpiry?: ExpiryAlertBucket;
  counts?: {
    stores: number;
    expiredTradeLicenses: number;
    pendingApprovals: number;
    inventorySkus: number;
  };
};

export async function getSalesAccountDashboard(
  userId: string,
  opts?: { companyKey?: CompanyKey; companyId?: string },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyKey) qs.set("companyKey", opts.companyKey);
  if (opts?.companyId) qs.set("companyId", opts.companyId);
  return request<SalesAccountDashboard>(`/sales/account?${qs}`);
}

export async function getAdminKpiDashboard(
  userId: string,
  opts?: { companyKey?: CompanyKey; companyId?: string },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyKey) qs.set("companyKey", opts.companyKey);
  if (opts?.companyId) qs.set("companyId", opts.companyId);
  return request<AdminKpiDashboard>(`/admin/dashboard?${qs}`);
}

export type AdminSalesmanBreakdown = {
  salesman: { id: string; name?: string; email?: string };
  year: number;
  month: number;
  companyKey: CompanyKey | null;
  delivered: number;
  target: number | null;
  progress: number | null;
  performance: {
    totalDelivered: number;
    stl: {
      delivered: number;
      target: number | null;
      progress: number | null;
    };
    shmp: {
      delivered: number;
      target: number | null;
      progress: number | null;
    };
  };
  products: Array<{
    productId: string;
    name: string;
    itemCode?: string;
    revenue: number;
    qty: number;
  }>;
  stores: Array<{
    storeId: string;
    name: string;
    address?: string;
    value: number;
    orders: number;
  }>;
  orders: Array<{
    orderId: string;
    invoiceNumber?: string;
    date?: string;
    storeId?: string;
    storeName?: string;
    amount: number;
    companyKey?: string;
  }>;
};

export async function getAdminSalesmanBreakdown(
  userId: string,
  salesId: string,
  opts?: { companyKey?: CompanyKey; year?: number; month?: number },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyKey) qs.set("companyKey", opts.companyKey);
  if (opts?.year) qs.set("year", String(opts.year));
  if (opts?.month) qs.set("month", String(opts.month));
  return request<AdminSalesmanBreakdown>(
    `/admin/dashboard/salesman/${encodeURIComponent(salesId)}?${qs}`,
  );
}

export async function getAdminSalesLost(
  userId: string,
  opts?: { companyKey?: CompanyKey; year?: number; month?: number },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyKey) qs.set("companyKey", opts.companyKey);
  if (opts?.year) qs.set("year", String(opts.year));
  if (opts?.month) qs.set("month", String(opts.month));
  return request<{
    year: number;
    month: number;
    totalLost: number;
    lineCount: number;
    products: Array<{
      productId: string;
      productName: string;
      itemCode?: string;
      categoryName?: string;
      quantityReq: number;
      lostValue: number;
      orderCount: number;
    }>;
  }>(`/admin/dashboard/sales-lost?${qs}`);
}

export async function getLeaveSettings(userId: string, companyId?: string) {
  const qs = new URLSearchParams({ userId });
  if (companyId) qs.set("companyId", companyId);
  return request<{
    resolved: { annualLeaveDays: number; sickLeaveDays: number };
    defaults: { annualLeaveDays: number; sickLeaveDays: number };
    settings: unknown[];
  }>(`/admin/leave-settings?${qs}`);
}

export async function saveLeaveSettings(payload: {
  userId: string;
  annualLeaveDays: number;
  sickLeaveDays: number;
  companyId?: string | null;
}) {
  return request<unknown>("/admin/leave-settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getModuleAccessMe(userId: string) {
  return request<{
    modules: string[];
    moduleAccess: string[] | null;
    effectiveModules: string[];
    canEditPermissions: boolean;
  }>(`/admin/module-access/me?userId=${encodeURIComponent(userId)}`);
}

export async function getModuleAccessUsers(userId: string) {
  return request<{
    modules: string[];
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      isSuperAdmin: boolean;
      moduleAccess: string[] | null;
      effectiveModules: string[];
    }>;
  }>(`/admin/module-access/users?userId=${encodeURIComponent(userId)}`);
}

export async function updateModuleAccess(
  adminUserId: string,
  targetUserId: string,
  moduleAccess: string[] | null,
) {
  return request<unknown>(`/admin/module-access/users/${targetUserId}`, {
    method: "PUT",
    body: JSON.stringify({ userId: adminUserId, moduleAccess }),
  });
}

export async function overrideSalesAttendance(payload: {
  userId: string;
  salesId: string;
  date: string;
  status: "present" | "absent";
  reason?: string;
  companyId?: string;
}) {
  return request<unknown>("/admin/attendance/override", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAttendanceOverrides(userId: string) {
  return request<{ overrides: unknown[] }>(
    `/admin/attendance/override?userId=${encodeURIComponent(userId)}`,
  );
}

export async function getSalesAttendanceReport(
  userId: string,
  opts: {
    companyKey?: CompanyKey | "all";
    from?: string;
    to?: string;
    year?: number;
    month?: number;
  },
) {
  const qs = new URLSearchParams({ userId });
  if (opts.companyKey && opts.companyKey !== "all") {
    qs.set("companyKey", opts.companyKey);
  }
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  if (opts.year) qs.set("year", String(opts.year));
  if (opts.month) qs.set("month", String(opts.month));
  return request<{
    companyKey: string;
    from: string;
    to: string;
    timezone: string;
    rows: Array<{
      sales: { id: string; name: string; email: string };
      summary: {
        present: number;
        absent: number;
        leave: number;
        days: number;
      };
      days: Array<{
        date: string;
        status: string;
        checkInAt?: string | null;
        checkOutAt?: string | null;
        overridden?: boolean;
      }>;
    }>;
  }>(`/admin/attendance/reports/sales?${qs}`);
}

export async function getHrStaff(
  userId: string,
  opts?: { companyId?: string; role?: string; scope?: "stl" | "shmp" },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyId) qs.set("companyId", opts.companyId);
  if (opts?.role) qs.set("role", opts.role);
  if (opts?.scope) qs.set("scope", opts.scope);
  return request<{ staff: HrStaff[] }>(`/admin/hr?${qs}`);
}

export type HrFileRef = {
  key: string;
  fileName: string;
  contentType?: string;
  url?: string;
};

export type HrStaff = {
  id: string;
  kind?: "user" | "staff" | "employee";
  scope?: "stl" | "shmp";
  name: string;
  email: string;
  role: string;
  linkedUserId?: string | null;
  mobileNumber?: string;
  yearsOfService?: number | null;
  joiningDate?: string | null;
  hrProfile?: HrProfile;
};

export type HrProfile = {
  visaApplicationYear?: number;
  visaCost?: number;
  visaNumber?: string;
  visaDetails?: string;
  visaExpiry?: string;
  visaDesignation?: string;
  visaName?: string;
  basicSalary?: number;
  totalSalary?: number;
  salaryIncrements?: Array<{
    effectiveDate: string;
    amount: number;
    notes?: string;
  }>;
  company?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportCopy?: HrFileRef | null;
  eidNumber?: string;
  eidExpiry?: string;
  eidCopy?: HrFileRef | null;
  visaCopy?: HrFileRef | null;
  photo?: HrFileRef | null;
  insuranceExpiry?: string;
  insuranceCopy?: HrFileRef | null;
  employmentContractCopy?: HrFileRef | null;
  offerLetter?: HrFileRef | null;
  sharjahPermitExpiry?: string;
  sharjahPermitCopy?: HrFileRef | null;
};

export async function getHrStaffMember(userId: string, id: string) {
  return request<HrStaff>(
    `/admin/hr/${id}?userId=${encodeURIComponent(userId)}`,
  );
}

export async function updateHrStaff(
  adminUserId: string,
  id: string,
  hrProfile: Record<string, unknown>,
  options?: { enforceDocuments?: boolean },
) {
  return request<HrStaff>(`/admin/hr/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      userId: adminUserId,
      hrProfile,
      enforceDocuments: options?.enforceDocuments === true,
    }),
  });
}

export async function uploadHrFile(adminUserId: string, file: File) {
  const body = new FormData();
  body.set("userId", adminUserId);
  body.set("file", file);
  return request<HrFileRef>("/admin/hr/files", { method: "POST", body });
}

export async function createHrStaff(
  adminUserId: string,
  payload: {
    scope: "stl" | "shmp";
    email?: string;
    mobileNumber?: string;
    joiningDate?: string;
    hrProfile: Record<string, unknown>;
    linkedUserId?: string;
  },
) {
  return request<HrStaff>("/admin/hr/staff", {
    method: "POST",
    body: JSON.stringify({ userId: adminUserId, ...payload }),
  });
}

export async function getHrStaffRecord(adminUserId: string, id: string) {
  return request<HrStaff>(
    `/admin/hr/staff/${id}?userId=${encodeURIComponent(adminUserId)}`,
  );
}

export async function updateHrStaffRecord(
  adminUserId: string,
  id: string,
  payload: {
    hrProfile: Record<string, unknown>;
    email?: string;
    mobileNumber?: string;
    joiningDate?: string;
    linkedUserId?: string | null;
    enforceDocuments?: boolean;
  },
) {
  return request<HrStaff>(`/admin/hr/staff/${id}`, {
    method: "PUT",
    body: JSON.stringify({ userId: adminUserId, ...payload }),
  });
}

export async function getHrLinkCandidates(
  adminUserId: string,
  scope: "stl" | "shmp",
  except?: string,
) {
  const qs = new URLSearchParams({ userId: adminUserId, scope });
  if (except) qs.set("except", except);
  return request<{
    users: Array<{ id: string; name: string; email: string; role: string }>;
  }>(`/admin/hr/link-candidates?${qs}`);
}

export async function getEmployeeHr(adminUserId: string, id: string) {
  return request<HrStaff>(
    `/admin/hr/employees/${id}?userId=${encodeURIComponent(adminUserId)}`,
  );
}

export async function updateEmployeeHr(
  adminUserId: string,
  id: string,
  hrProfile: Record<string, unknown>,
) {
  return request<HrStaff>(`/admin/hr/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      userId: adminUserId,
      hrProfile,
      enforceDocuments: true,
    }),
  });
}

export async function addHrIncrement(
  adminUserId: string,
  id: string,
  payload: {
    amount: number;
    effectiveDate?: string;
    notes?: string;
    setAsBasic?: boolean;
  },
) {
  return request<HrStaff>(`/admin/hr/${id}/increments`, {
    method: "POST",
    body: JSON.stringify({ userId: adminUserId, ...payload }),
  });
}

export async function addHrStaffIncrement(
  adminUserId: string,
  id: string,
  payload: {
    amount: number;
    effectiveDate?: string;
    notes?: string;
    setAsBasic?: boolean;
  },
) {
  return request<HrStaff>(`/admin/hr/staff/${id}/increments`, {
    method: "POST",
    body: JSON.stringify({ userId: adminUserId, ...payload }),
  });
}

export async function getDriverDeliveriesToday(opts: {
  driverId?: string;
  driver?: string;
  date?: string;
}) {
  const qs = new URLSearchParams();
  if (opts.driverId) qs.set("driverId", opts.driverId);
  if (opts.driver) qs.set("driver", opts.driver);
  if (opts.date) qs.set("date", opts.date);
  return request<{
    driver: { id: string | null; name: string; phoneNo?: string };
    deliveries: Array<{
      orderId: string;
      sequence: number;
      storeName: string;
      address: string;
      cartons: number;
      scheduledAt?: string;
      mapsUrl?: string | null;
      location?: { lat: number; lng: number } | null;
    }>;
  }>(`/driver/today?${qs}`);
}

export type PortalLeaveEntitlement = { annual: number; sick: number };

async function siteJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  const res = await fetch(path, {
    ...options,
    cache: "no-store",
    headers,
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : text || res.statusText;
    throw new ApiError(msg || "Request failed", res.status);
  }
  return body as T;
}

export async function getPortalLeaveEntitlements(userIds: string[]) {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return {} as Record<string, PortalLeaveEntitlement>;
  const data = await siteJson<{
    entitlements?: Record<string, PortalLeaveEntitlement>;
  }>(`/api/admin/leave-entitlements?ids=${encodeURIComponent(ids.join(","))}`);
  return data.entitlements || {};
}

export async function savePortalLeaveEntitlements(payload: {
  userIds: string[];
  annualLeaveDays: number;
  sickLeaveDays: number;
}) {
  return siteJson<{ updated: number }>("/api/admin/leave-entitlements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

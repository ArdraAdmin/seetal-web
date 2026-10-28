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
  if (!headers.has("Content-Type") && options.body) {
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
  source?: "employee" | "user" | string;
  expiryDate?: string;
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
  visaExpiry: {
    count: number;
    employees: VisaExpiryPerson[];
    users: VisaExpiryPerson[];
  };
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
  opts?: { companyId?: string; role?: string },
) {
  const qs = new URLSearchParams({ userId });
  if (opts?.companyId) qs.set("companyId", opts.companyId);
  if (opts?.role) qs.set("role", opts.role);
  return request<{ staff: HrStaff[] }>(`/admin/hr?${qs}`);
}

export type HrStaff = {
  id: string;
  name: string;
  email: string;
  role: string;
  yearsOfService?: number | null;
  joiningDate?: string | null;
  hrProfile?: {
    visaApplicationYear?: number;
    visaCost?: number;
    visaNumber?: string;
    visaDetails?: string;
    visaExpiry?: string;
    basicSalary?: number;
    salaryIncrements?: Array<{
      effectiveDate: string;
      amount: number;
      notes?: string;
    }>;
    company?: string;
  };
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
) {
  return request<HrStaff>(`/admin/hr/${id}`, {
    method: "PUT",
    body: JSON.stringify({ userId: adminUserId, hrProfile }),
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

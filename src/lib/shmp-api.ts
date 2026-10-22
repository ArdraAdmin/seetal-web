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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
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

export const shmpDashboard = (params?: {
  companyId?: string;
  from?: string;
  to?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.companyId) q.set("companyId", params.companyId);
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  const qs = q.toString();
  return shmpRequest<Record<string, unknown>>(
    `/dashboard/summary${qs ? `?${qs}` : ""}`,
  );
};

export const shmpEmployees = (companyId?: string) =>
  shmpRequest<unknown[]>(
    `/employees${companyId ? `?companyId=${companyId}` : ""}`,
  );

export const shmpCreateEmployee = (body: Record<string, unknown>) =>
  shmpRequest("/employees", { method: "POST", body: JSON.stringify(body) });

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

export const shmpAttendance = (params?: Record<string, string>) => {
  const q = new URLSearchParams(params || {});
  return shmpRequest(`/attendance?${q}`);
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

export const shmpFleetVehicles = (ownershipCompany?: string) =>
  shmpRequest(
    `/fleet/vehicles${ownershipCompany ? `?ownershipCompany=${ownershipCompany}` : ""}`,
  );

export const shmpCreateFleetVehicle = (body: Record<string, unknown>) =>
  shmpRequest("/fleet/vehicles", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpAddVehicleExpense = (
  id: string,
  body: Record<string, unknown>,
) =>
  shmpRequest(`/fleet/vehicles/${id}/expenses`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const shmpAddVehicleService = (
  id: string,
  body: Record<string, unknown>,
) =>
  shmpRequest(`/fleet/vehicles/${id}/services`, {
    method: "POST",
    body: JSON.stringify(body),
  });

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

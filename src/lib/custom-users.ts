export const CUSTOM_COMPANY_KEYS = ["stl", "sarvah", "shmp", "shlaxmi"] as const;

export type CustomCompanyKey = (typeof CUSTOM_COMPANY_KEYS)[number];

export type AppSide = "stl" | "shmp";

export const CUSTOM_COMPANY_LABELS: Record<CustomCompanyKey, string> = {
  stl: "STL",
  sarvah: "Sarvah",
  shmp: "SHMP",
  shlaxmi: "SH Laxmi",
};

export const SELLING_COMPANY_KEYS: CustomCompanyKey[] = [
  "stl",
  "sarvah",
  "shlaxmi",
];

export type PortalModule = {
  id: string;
  label: string;
  href: string;
  match?: string[];
};

export const SELLING_MODULES: PortalModule[] = [
  { id: "dashboard", label: "KPI dashboard", href: "/admin" },
  {
    id: "drivers-vehicles",
    label: "Drivers & vehicles",
    href: "/admin/drivers-vehicles",
    match: ["/admin/drivers-vehicles", "/admin/drivers", "/admin/vehicles"],
  },
  { id: "stores", label: "Stores", href: "/admin/stores" },
  { id: "sales-profiles", label: "Sales profiles", href: "/admin/profiles/sales" },
  {
    id: "warehouse-profiles",
    label: "Warehouse profiles",
    href: "/admin/profiles/warehouse",
  },
  { id: "inventory", label: "Inventory", href: "/admin/inventory" },
  { id: "catalog", label: "Catalog", href: "/admin/catalog" },
  { id: "stock-transfer", label: "Stock transfer", href: "/admin/stock-transfer" },
  { id: "pending-orders", label: "Pending orders", href: "/admin/pending-orders" },
  { id: "approvals", label: "Approvals", href: "/admin/approvals" },
  { id: "leave", label: "Leave", href: "/admin/leave" },
  { id: "attendance", label: "Attendance", href: "/admin/attendance" },
  {
    id: "attendance-reports",
    label: "Attendance reports",
    href: "/admin/attendance-reports",
  },
  {
    id: "attendance-override",
    label: "Attendance override",
    href: "/admin/attendance-override",
  },
  { id: "leave-settings", label: "Leave settings", href: "/admin/leave-settings" },
  { id: "hr", label: "HR", href: "/admin/hr" },
  {
    id: "driver-deliveries",
    label: "Driver deliveries",
    href: "/admin/driver-deliveries",
  },
  { id: "sales-lost", label: "Sales lost", href: "/admin/sales-lost" },
  { id: "targets", label: "Sales targets", href: "/admin/targets" },
  { id: "grv", label: "GRV management", href: "/admin/grv" },
  { id: "categories", label: "Categories", href: "/admin/categories" },
  { id: "payments", label: "Payments", href: "/admin/payments" },
  { id: "warehouse", label: "Warehouse", href: "/admin/warehouse" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
];

export const SHMP_MODULES: PortalModule[] = [
  { id: "dashboard", label: "Dashboard", href: "/shmp" },
  { id: "hr", label: "HR", href: "/shmp/hr" },
  { id: "attendance", label: "Attendance", href: "/shmp/attendance" },
  { id: "stores", label: "Stores", href: "/shmp/stores" },
  { id: "inventory", label: "Inventory", href: "/shmp/inventory" },
  { id: "catalog", label: "Catalog", href: "/shmp/catalog" },
  { id: "production", label: "Production", href: "/shmp/production" },
  { id: "rm", label: "RM Store", href: "/shmp/rm" },
  { id: "orders", label: "Orders", href: "/shmp/orders" },
  { id: "delivery", label: "Delivery", href: "/shmp/delivery" },
  {
    id: "drivers-vehicles",
    label: "Drivers & vehicles",
    href: "/shmp/drivers-vehicles",
    match: ["/shmp/drivers-vehicles", "/shmp/drivers", "/shmp/vehicles"],
  },
  { id: "costing", label: "Product Costing", href: "/shmp/costing" },
  { id: "reports", label: "Reports", href: "/shmp/reports" },
  { id: "settings", label: "Settings", href: "/shmp/settings" },
];

/** STL API module keys granted when a selling-side toggle is on. */
const SELLING_API_KEYS: Record<string, string[]> = {
  dashboard: ["dashboard"],
  "drivers-vehicles": ["vehicles", "drivers"],
  stores: ["stores"],
  "sales-profiles": ["profiles"],
  "warehouse-profiles": ["profiles"],
  inventory: ["inventory"],
  catalog: ["inventory"],
  "stock-transfer": ["inventory"],
  "pending-orders": ["orders"],
  approvals: ["approvals"],
  leave: ["leave"],
  attendance: ["attendance"],
  "attendance-reports": ["attendance_reports"],
  "attendance-override": ["attendance_override"],
  "leave-settings": ["leave"],
  hr: ["hr"],
  "driver-deliveries": ["drivers"],
  "sales-lost": ["dashboard"],
  targets: ["targets"],
  grv: ["grv"],
  categories: ["categories"],
  payments: ["payments"],
  warehouse: ["warehouse"],
  settings: ["settings"],
};

const COMPANY_ALIASES: Record<CustomCompanyKey, string[]> = {
  stl: ["stl", "seetal"],
  sarvah: ["sarvah"],
  shmp: ["shmp"],
  shlaxmi: ["shlaxmi", "shlakshmi"],
};

const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export type CustomModuleMap = Partial<Record<CustomCompanyKey, string[]>>;

export type CustomAccess = {
  companies: CustomCompanyKey[];
  modules: CustomModuleMap;
};

export type CustomUserRecord = {
  id: string;
  name: string;
  email: string;
  companies: CustomCompanyKey[];
  modules: CustomModuleMap;
};

export function isCustomCompanyKey(value: string): value is CustomCompanyKey {
  return (CUSTOM_COMPANY_KEYS as readonly string[]).includes(value);
}

export function modulesForCompany(company: CustomCompanyKey): PortalModule[] {
  return company === "shmp" ? SHMP_MODULES : SELLING_MODULES;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validatePassword(password: string, required: boolean): string | null {
  if (!password) return required ? "Password is required" : null;
  if (password.length < 4) return "Password should be greater than 4 characters";
  if (/\s/.test(password)) return "Password should not contain whitespaces";
  return null;
}

export function sanitizeCustomAccess(
  input: { companies?: unknown; modules?: unknown },
): { ok: true; access: CustomAccess } | { ok: false; error: string } {
  if (!Array.isArray(input.companies) || input.companies.length === 0) {
    return { ok: false, error: "Select at least one company" };
  }
  const companies: CustomCompanyKey[] = [];
  for (const raw of input.companies) {
    const key = String(raw || "").trim().toLowerCase();
    if (!isCustomCompanyKey(key)) {
      return { ok: false, error: "Unknown company" };
    }
    if (!companies.includes(key)) companies.push(key);
  }
  const modulesInput =
    input.modules && typeof input.modules === "object"
      ? (input.modules as Record<string, unknown>)
      : {};
  const modules: CustomModuleMap = {};
  let enabled = 0;
  for (const company of companies) {
    const allowed = new Set(modulesForCompany(company).map((item) => item.id));
    const rawList = modulesInput[company];
    const picked = Array.isArray(rawList) ? rawList.map((id) => String(id)) : [];
    const next = [...new Set(picked.filter((id) => allowed.has(id)))];
    modules[company] = next;
    enabled += next.length;
  }
  if (enabled === 0) {
    return { ok: false, error: "Turn on at least one module" };
  }
  return { ok: true, access: { companies, modules } };
}

/** Cookie value. Missing means a normal account. Invalid means no modules. */
export function readCustomAccess(value: unknown): CustomAccess | null {
  if (value == null) return null;
  const record =
    typeof value === "object"
      ? (value as { companies?: unknown; modules?: unknown })
      : {};
  const result = sanitizeCustomAccess(record);
  if (!result.ok) return { companies: [], modules: {} };
  return result.access;
}

export function validateCustomUserInput(
  input: unknown,
  mode: "create" | "update",
):
  | {
      ok: true;
      value: { name: string; email: string; password: string; access: CustomAccess };
    }
  | { ok: false; error: string } {
  const body =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const name = String(body.name || "").trim();
  const email = normalizeEmail(String(body.email || ""));
  const password = String(body.password || "");
  if (!name) return { ok: false, error: "Name is required" };
  if (name.length > 120) return { ok: false, error: "Name is too long" };
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email" };
  }
  const passwordError = validatePassword(password, mode === "create");
  if (passwordError) return { ok: false, error: passwordError };
  const access = sanitizeCustomAccess({
    companies: body.companies,
    modules: body.modules,
  });
  if (!access.ok) return access;
  return { ok: true, value: { name, email, password, access: access.access } };
}

export function environmentsForAccess(access: CustomAccess): AppSide[] {
  const envs: AppSide[] = [];
  const selling = SELLING_COMPANY_KEYS.some(
    (key) => (access.modules[key] || []).length > 0,
  );
  if (selling) envs.push("stl");
  if ((access.modules.shmp || []).length > 0) envs.push("shmp");
  return envs;
}

/** API module list. A placeholder keeps an empty list from meaning full access. */
export function apiModuleKeysForAccess(access: CustomAccess): string[] {
  const keys = new Set<string>();
  let selling = false;
  for (const company of SELLING_COMPANY_KEYS) {
    const enabled = access.modules[company] || [];
    if (!access.companies.includes(company) || enabled.length === 0) continue;
    selling = true;
    for (const id of enabled) {
      for (const key of SELLING_API_KEYS[id] || []) keys.add(key);
    }
  }
  if (!selling) keys.add("__none__");
  return [...keys];
}

export function moduleEnabled(
  access: CustomAccess,
  company: CustomCompanyKey,
  moduleId: string,
) {
  return (access.modules[company] || []).includes(moduleId);
}

export function sellingModuleVisible(access: CustomAccess, moduleId: string) {
  return SELLING_COMPANY_KEYS.some(
    (key) =>
      access.companies.includes(key) && moduleEnabled(access, key, moduleId),
  );
}

export function shmpModuleVisible(access: CustomAccess, moduleId: string) {
  return access.companies.includes("shmp") && moduleEnabled(access, "shmp", moduleId);
}

export function companyKeysWithModule(access: CustomAccess, moduleId: string) {
  return access.companies.filter((key) => moduleEnabled(access, key, moduleId));
}

function prefixHit(pathname: string, prefix: string) {
  if (prefix === "/admin" || prefix === "/shmp") return pathname === prefix;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function longestMatch(modules: PortalModule[], pathname: string) {
  let best: PortalModule | null = null;
  let bestLen = -1;
  for (const item of modules) {
    for (const prefix of item.match ?? [item.href]) {
      if (prefixHit(pathname, prefix) && prefix.length > bestLen) {
        best = item;
        bestLen = prefix.length;
      }
    }
  }
  return best;
}

export function canCustomUserAccessPath(access: CustomAccess, pathname: string) {
  if (prefixHit(pathname, "/admin/users") || prefixHit(pathname, "/shmp/users")) {
    return false;
  }
  if (
    prefixHit(pathname, "/admin/permissions") ||
    prefixHit(pathname, "/admin/tracking")
  ) {
    return false;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const item = longestMatch(SELLING_MODULES, pathname);
    return item ? sellingModuleVisible(access, item.id) : false;
  }
  if (pathname === "/shmp" || pathname.startsWith("/shmp/")) {
    const item = longestMatch(SHMP_MODULES, pathname);
    return item ? shmpModuleVisible(access, item.id) : false;
  }
  return true;
}

export function firstAllowedPath(access: CustomAccess, env: AppSide): string | null {
  const modules = env === "shmp" ? SHMP_MODULES : SELLING_MODULES;
  const visible =
    env === "shmp"
      ? (id: string) => shmpModuleVisible(access, id)
      : (id: string) => sellingModuleVisible(access, id);
  return modules.find((item) => visible(item.id))?.href ?? null;
}

export function customHomePath(
  access: CustomAccess,
  envs: AppSide[],
  selected: AppSide | null,
): string {
  if (envs.length > 1 && !selected) return "/select-environment";
  const env = selected && envs.includes(selected) ? selected : envs[0];
  if (!env) return "/no-access";
  return (
    firstAllowedPath(access, env) ||
    firstAllowedPath(access, env === "stl" ? "shmp" : "stl") ||
    "/no-access"
  );
}

function normalizeCompanyToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenMatches(key: CustomCompanyKey, token: string) {
  if (COMPANY_ALIASES[key].includes(token)) return true;
  if (key === "stl" && token.startsWith("stl")) return true;
  if (key === "sarvah" && token.includes("sarvah")) return true;
  if (key === "shmp" && token.includes("shmp")) return true;
  if (
    key === "shlaxmi" &&
    (token.includes("shlaxmi") || token.includes("shlakshmi"))
  ) {
    return true;
  }
  return false;
}

export function companyKeyFromRecord(company: {
  name?: string;
  prefix?: string;
}): CustomCompanyKey | null {
  const tokens = [company.name, company.prefix]
    .map((value) => normalizeCompanyToken(String(value || "")))
    .filter(Boolean);
  for (const key of CUSTOM_COMPANY_KEYS) {
    if (tokens.some((token) => COMPANY_ALIASES[key].includes(token))) return key;
  }
  for (const key of CUSTOM_COMPANY_KEYS) {
    if (tokens.some((token) => tokenMatches(key, token))) return key;
  }
  return null;
}

export function filterCompaniesForModule<
  T extends { name?: string; prefix?: string },
>(
  companies: T[],
  access: CustomAccess | null | undefined,
  moduleId: string,
): T[] {
  if (!access) return companies;
  const keys = new Set(companyKeysWithModule(access, moduleId));
  return companies.filter((company) => {
    const key = companyKeyFromRecord(company);
    return key !== null && keys.has(key);
  });
}

export function enabledModuleCount(access: Pick<CustomAccess, "companies" | "modules">) {
  return access.companies.reduce(
    (total, key) => total + (access.modules[key]?.length || 0),
    0,
  );
}

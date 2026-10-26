import type { SalesCompanyAccess } from "./sales-company";

export type SalesCompanyKey = "stl" | "sarvah" | "shmp" | "shlaxmi";
export type SalesInventoryKey = "stl" | "shmp";

export type SelectedSalesCompany = {
  id: string;
  name: SalesInventoryKey;
};

export const SALES_COMPANY_KEYS: SalesCompanyKey[] = [
  "stl",
  "sarvah",
  "shmp",
  "shlaxmi",
];

export const SELECTABLE_SALES_COMPANY_KEYS: SalesCompanyKey[] = [
  "stl",
  "sarvah",
  "shmp",
];

export const SALES_COMPANY_LABELS: Record<SalesCompanyKey, string> = {
  stl: "STL",
  sarvah: "Sarvah",
  shmp: "SHMP",
  shlaxmi: "SH Laxmi",
};

const COMPANY_ALIASES: Record<SalesCompanyKey, string[]> = {
  stl: ["stl", "seetal"],
  sarvah: ["sarvah"],
  shmp: ["shmp"],
  shlaxmi: ["shlaxmi", "shlakshmi"],
};

const COMPANY_ACCESS_NAMES: Record<SalesCompanyKey, string[]> = {
  stl: ["STL"],
  sarvah: ["Sarvah"],
  shmp: ["SHMP"],
  shlaxmi: ["SH Laxmi", "SH Lakshmi"],
};

const ID_KEY = "stl_sales_selected_company_id";
const NAME_KEY = "stl_sales_selected_company_name";
const WORKSPACE_KEY = "stl_sales_workspace";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function normalizeCompanyToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSalesCompanyKey(value: string): value is SalesCompanyKey {
  return SALES_COMPANY_KEYS.includes(value as SalesCompanyKey);
}

export function isSelectableSalesCompanyKey(
  value: string,
): value is SalesCompanyKey {
  return SELECTABLE_SALES_COMPANY_KEYS.includes(value as SalesCompanyKey);
}

export function isSalesInventoryKey(value: string): value is SalesInventoryKey {
  return value === "stl" || value === "shmp";
}

export function onSelectedSalesCompanyChange(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function hasSelectedSalesCompany() {
  const selected = loadSelectedSalesCompany();
  return Boolean(selected?.id && selected.name);
}

export function loadSalesWorkspace(): SalesCompanyKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = String(localStorage.getItem(WORKSPACE_KEY) || "")
      .trim()
      .toLowerCase();
    if (isSelectableSalesCompanyKey(raw)) return raw;
    return loadSelectedSalesCompany()?.name ?? null;
  } catch {
    return loadSelectedSalesCompany()?.name ?? null;
  }
}

export function saveSalesWorkspace(key: SalesCompanyKey) {
  if (typeof window === "undefined") return;
  if (!isSelectableSalesCompanyKey(key)) return;
  localStorage.setItem(WORKSPACE_KEY, key);
  notify();
}

export function openSarvahWorkspace() {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACE_KEY, "sarvah");
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  notify();
}

export function hasSelectedSalesWorkspace() {
  return Boolean(loadSalesWorkspace());
}

export function loadSelectedSalesCompany(): SelectedSalesCompany | null {
  if (typeof window === "undefined") return null;
  try {
    const id = String(localStorage.getItem(ID_KEY) || "").trim();
    const rawName = String(localStorage.getItem(NAME_KEY) || "")
      .trim()
      .toLowerCase();
    if (!id || !isSalesInventoryKey(rawName)) return null;
    return { id, name: rawName };
  } catch {
    return null;
  }
}

export function saveSelectedSalesCompany(selected: SelectedSalesCompany) {
  if (typeof window === "undefined") return;
  if (!isSalesInventoryKey(selected.name) || !selected.id.trim()) return;
  localStorage.setItem(ID_KEY, selected.id.trim());
  localStorage.setItem(NAME_KEY, selected.name.trim().toLowerCase());
  notify();
}

export function clearSalesInventory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  notify();
}

export function clearSelectedSalesCompany() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  notify();
}

export function selectedCompanyDisplayName(
  selected: SelectedSalesCompany | null | undefined,
) {
  if (!selected) return "";
  return SALES_COMPANY_LABELS[selected.name] || selected.name.toUpperCase();
}

export function salesWorkspaceDisplayName() {
  const workspace = loadSalesWorkspace();
  const inventory = loadSelectedSalesCompany();
  if (!workspace) return selectedCompanyDisplayName(inventory);
  const workspaceLabel = SALES_COMPANY_LABELS[workspace];
  if (inventory && workspace === "sarvah") {
    return `${workspaceLabel} · ${SALES_COMPANY_LABELS[inventory.name]}`;
  }
  return workspaceLabel;
}

export function salesCompanyStoreMode(
  key?: SalesCompanyKey | null,
): "all" | "assigned" {
  return key === "shmp" ? "assigned" : "all";
}

function companyTokens(company: { name?: string; prefix?: string }) {
  return [
    normalizeCompanyToken(String(company.name || "")),
    normalizeCompanyToken(String(company.prefix || "")),
  ].filter(Boolean);
}

function matchesCompanyKey(
  company: { name?: string; prefix?: string },
  key: SalesCompanyKey,
) {
  const aliases = COMPANY_ALIASES[key];
  return companyTokens(company).some((token) => {
    if (aliases.includes(token)) return true;
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
  });
}

/** Resolve STL / SHMP inventory to a company id from `/admin/company`. */
export function resolveSalesCompanyByKey(
  key: SalesCompanyKey,
  companies: { _id: string; name?: string; prefix?: string }[],
): SelectedSalesCompany | null {
  if (!isSalesInventoryKey(key)) return null;
  const aliases = COMPANY_ALIASES[key];
  const exactName = companies.find((company) =>
    aliases.includes(normalizeCompanyToken(String(company.name || ""))),
  );
  const exactPrefix = companies.find((company) =>
    aliases.includes(normalizeCompanyToken(String(company.prefix || ""))),
  );
  const fuzzy = companies.find((company) => matchesCompanyKey(company, key));
  const match = exactName || exactPrefix || fuzzy;
  const id = String(match?._id || "").trim();
  if (!id) return null;
  return { id, name: key };
}

export function accessFromSelectedCompany(
  selected: SelectedSalesCompany,
): SalesCompanyAccess {
  return {
    companyIds: selected.id ? [selected.id] : [],
    companyNames: COMPANY_ACCESS_NAMES[selected.name] || [
      SALES_COMPANY_LABELS[selected.name],
    ],
    includeUnassigned: selected.name === "stl",
  };
}

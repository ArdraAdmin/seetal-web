import type { SalesCompanyAccess } from "./sales-company";

export type SalesCompanyKey = "stl" | "shmp";

export type SelectedSalesCompany = {
  id: string;
  name: SalesCompanyKey;
};

const ID_KEY = "stl_sales_selected_company_id";
const NAME_KEY = "stl_sales_selected_company_name";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
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

export function loadSelectedSalesCompany(): SelectedSalesCompany | null {
  if (typeof window === "undefined") return null;
  try {
    const id = String(localStorage.getItem(ID_KEY) || "").trim();
    const rawName = String(localStorage.getItem(NAME_KEY) || "")
      .trim()
      .toLowerCase();
    if (!id || (rawName !== "stl" && rawName !== "shmp")) return null;
    return { id, name: rawName };
  } catch {
    return null;
  }
}

export function saveSelectedSalesCompany(selected: SelectedSalesCompany) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ID_KEY, selected.id.trim());
  localStorage.setItem(NAME_KEY, selected.name.trim().toLowerCase());
  notify();
}

export function clearSelectedSalesCompany() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  notify();
}

export function selectedCompanyDisplayName(
  selected: SelectedSalesCompany | null | undefined,
) {
  if (!selected) return "";
  return selected.name === "shmp" ? "SHMP" : "STL";
}

/** Resolve STL / SHMP to a company id from `/admin/company`. */
export function resolveSalesCompanyByKey(
  key: SalesCompanyKey,
  companies: { _id: string; name?: string }[],
): SelectedSalesCompany | null {
  const wanted = key.trim().toLowerCase();
  if (wanted !== "stl" && wanted !== "shmp") return null;
  for (const company of companies) {
    const name = String(company.name || "")
      .trim()
      .toLowerCase();
    if (name === wanted) {
      const id = String(company._id || "").trim();
      if (!id) return null;
      return { id, name: wanted };
    }
  }
  return null;
}

export function accessFromSelectedCompany(
  selected: SelectedSalesCompany,
): SalesCompanyAccess {
  const isStl = selected.name === "stl";
  return {
    companyIds: selected.id ? [selected.id] : [],
    companyNames: isStl ? ["STL"] : ["SHMP"],
    includeUnassigned: isStl,
  };
}

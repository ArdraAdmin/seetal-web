import type { ShmpCategoryValue } from "./shmp-api";

export type HrDayFilter = "total" | "present" | "absent" | "leave";

export function parseHrDayFilter(
  value: string | null | undefined,
): HrDayFilter | null {
  if (
    value === "total" ||
    value === "present" ||
    value === "absent" ||
    value === "leave"
  ) {
    return value;
  }
  return null;
}

export function attendanceFilterHref(filter: HrDayFilter): string {
  return `/shmp/attendance?filter=${filter}`;
}

export function hrFilterHref(filter: HrDayFilter): string {
  return attendanceFilterHref(filter);
}

export type SalesCategorySlice = {
  key: string;
  label: string;
  value: number;
};

/**
 * SHMP sales by category. Existing SHMP-labelled stock is Sarvah inventory
 * and must not count until SHMP production products exist.
 */
export function shmpSalesCategoryRows(
  salesValueByCategory: ShmpCategoryValue[] | undefined,
  hasOwnInventory: boolean,
): SalesCategorySlice[] {
  if (!hasOwnInventory) return [];
  const grouped = new Map<string, number>();
  for (const row of salesValueByCategory || []) {
    const raw =
      row.categoryName || (row._id ? String(row._id) : "Uncategorised");
    const label = raw.split(" — ")[0].trim() || "Uncategorised";
    const value = Number(row.value) || 0;
    if (value <= 0) continue;
    grouped.set(label, (grouped.get(label) || 0) + value);
  }
  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      key: label,
      label,
      value,
    }));
}

export function shmpSalesTotal(rows: SalesCategorySlice[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0);
}

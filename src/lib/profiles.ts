import type { ProfileUser } from "./types";

type SalesField = {
  spouseName?: string;
  dob?: string;
  joiningDate?: string;
  address?: string;
  accessToInv?: boolean;
  company?: unknown;
};

type WarehouseField = {
  isSuperManager?: boolean;
  masterCategoryId?: string;
  pinNumber?: number | string;
};

export function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function salesField(user: ProfileUser): SalesField {
  const field = asObject(user.field);
  const sales = asObject(field?.sales);
  return (sales || {}) as SalesField;
}

export function warehouseField(user: ProfileUser): WarehouseField {
  const field = asObject(user.field);
  const warehouse = asObject(field?.warehouse);
  return (warehouse || {}) as WarehouseField;
}

export function asId(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in value) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  return String(value);
}

export function companyIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(asId).filter(Boolean);
  }
  const id = asId(raw);
  return id ? [id] : [];
}

export function dateInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function masterCategoryName(
  categories: { masterCategoryId?: string; masterCategoryName?: string; name?: string }[],
  id?: string,
) {
  if (!id) return "";
  const match = categories.find((item) => item.masterCategoryId === id);
  return match?.masterCategoryName || match?.name || "";
}

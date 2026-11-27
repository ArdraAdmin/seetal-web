/** Seetal inventory is split across these selling companies. */
export const INVENTORY_COMPANY_KEYS = ["stl", "shlaxmi", "sarvah"] as const;

export type InventoryCompanyKey = (typeof INVENTORY_COMPANY_KEYS)[number];

const INVENTORY_COMPANY_LABELS: Record<InventoryCompanyKey, string> = {
  stl: "STL",
  shlaxmi: "SH Lakshmi",
  sarvah: "Sarvah",
};

export function inventoryCompanyLabel(key: InventoryCompanyKey) {
  return INVENTORY_COMPANY_LABELS[key];
}

export function inventoryCompanyHref(key: InventoryCompanyKey) {
  return `/admin/inventory/company/${key}`;
}

export function parseInventoryCompanyKey(
  value: string | null | undefined,
): InventoryCompanyKey | null {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return (INVENTORY_COMPANY_KEYS as readonly string[]).includes(key)
    ? (key as InventoryCompanyKey)
    : null;
}

/** Keep the requested company when it is allowed. Otherwise open STL. */
export function activeInventoryCompany(
  requested: string | null | undefined,
  allowed: readonly InventoryCompanyKey[],
): InventoryCompanyKey | null {
  if (allowed.length === 0) return null;
  const parsed = parseInventoryCompanyKey(requested);
  if (parsed && allowed.includes(parsed)) return parsed;
  if (allowed.includes("stl")) return "stl";
  return allowed[0];
}

function text(value: unknown) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function finiteNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

function readInQty(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const cartons = finiteNumber(row.amountInCartons);
  const units = finiteNumber(row.amountInUnits);
  if (cartons === undefined && units === undefined) return undefined;
  return {
    amountInCartons: cartons ?? 0,
    amountInUnits: units ?? 0,
  };
}

/** Fields the inventory list shows, taken from a company-catalogue row. */
export function inventoryFieldsFromRecord(record: Record<string, unknown>) {
  const unit = text(record.unit);
  const ratio = finiteNumber(record.ratio);
  const sellingPrice = finiteNumber(record.sellingPrice);
  const barCode = text(record.barCode);
  const barcode = text(record.barcode);
  const isDisplay =
    typeof record.isDisplay === "boolean" ? record.isDisplay : undefined;
  const inQty = readInQty(record.inQty);
  return {
    ...(unit ? { unit } : {}),
    ...(ratio !== undefined ? { ratio } : {}),
    ...(sellingPrice !== undefined ? { sellingPrice } : {}),
    ...(barCode ? { barCode } : {}),
    ...(barcode ? { barcode } : {}),
    ...(isDisplay !== undefined ? { isDisplay } : {}),
    ...(inQty ? { inQty } : {}),
  };
}

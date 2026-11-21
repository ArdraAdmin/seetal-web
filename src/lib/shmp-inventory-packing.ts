/** SHMP inventory unit / packing ratio helpers. */

export const SHMP_UNITS = ["Pcs", "Sets", "Box"] as const;
export type ShmpUnit = (typeof SHMP_UNITS)[number];

export const UNIT_RATIO_KINDS = ["Pcs", "Pcs/Set", "Pcs/Box"] as const;
export type UnitRatioKind = (typeof UNIT_RATIO_KINDS)[number];

export const CARTON_RATIO_KINDS = ["Pcs/Ctn", "Sets/Ctn", "Box/Ctn"] as const;
export type CartonRatioKind = (typeof CARTON_RATIO_KINDS)[number];

export const UNIT_RATIO_HINT =
  "How many pieces make up one selling unit. Choose Pcs when you sell loose pieces, Pcs/Set when pieces are sold in sets, or Pcs/Box when pieces are packed in an inner box.";

export const CARTON_RATIO_HINT =
  "How many pieces, sets, or inner boxes fit in one outer carton. Together with the unit ratio above, this sets pieces per carton for stock and sales.";

export const PACKING_LABELS_HINT =
  "How many labels are applied when packing this item (for example labels per piece, set, or carton as you use them on the floor).";

export const PACKING_INNERS_HINT =
  "How many inner boxes (inners) are packed inside one outer carton for this item.";

export const PACKING_OUTERS_HINT =
  "How many outer cartons make up the packing configuration you track for this item.";

export function isShmpUnit(value: string): value is ShmpUnit {
  return (SHMP_UNITS as readonly string[]).includes(value);
}

export function isUnitRatioKind(value: string): value is UnitRatioKind {
  return (UNIT_RATIO_KINDS as readonly string[]).includes(value);
}

export function isCartonRatioKind(value: string): value is CartonRatioKind {
  return (CARTON_RATIO_KINDS as readonly string[]).includes(value);
}

/** Map legacy free-text units onto the new dropdown values. */
export function normalizeShmpUnit(value: unknown): ShmpUnit | "" {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!raw) return "";
  if (raw === "pcs" || raw === "pc" || raw === "piece" || raw === "pieces") {
    return "Pcs";
  }
  if (raw === "set" || raw === "sets") return "Sets";
  if (raw === "box" || raw === "boxes") return "Box";
  if (isShmpUnit(String(value ?? "").trim())) {
    return String(value).trim() as ShmpUnit;
  }
  return "";
}

/**
 * Pieces per carton for stock/sales (`ratio`).
 * - Pcs/Ctn uses the carton count directly.
 * - Sets/Ctn or Box/Ctn multiplies by pieces per set/box when that is set.
 */
export function derivePiecesPerCarton(
  unitRatioKind: string,
  unitRatioValue: number,
  cartonRatioKind: string,
  cartonRatioValue: number,
): number {
  const unitVal = Math.max(Number(unitRatioValue) || 0, 0);
  const cartonVal = Math.max(Number(cartonRatioValue) || 0, 0);
  if (!(cartonVal > 0)) return 1;

  if (cartonRatioKind === "Pcs/Ctn") {
    return Math.max(Math.floor(cartonVal) || cartonVal, 1);
  }

  const piecesPerInner =
    unitRatioKind === "Pcs" || unitRatioKind === ""
      ? 1
      : Math.max(unitVal, 1);
  return Math.max(piecesPerInner * cartonVal, 1);
}

export type PackingRatioFields = {
  unitRatioKind?: unknown;
  unitRatioValue?: unknown;
  cartonRatioKind?: unknown;
  cartonRatioValue?: unknown;
  ratio?: unknown;
};

/**
 * Migration A: missing structured ratios become Pcs + 1 and Pcs/Ctn + legacy ratio.
 */
export function packingRatiosFromProduct(product: PackingRatioFields): {
  unitRatioKind: UnitRatioKind;
  unitRatioValue: string;
  cartonRatioKind: CartonRatioKind;
  cartonRatioValue: string;
} {
  const legacyRatio = Math.max(Number(product.ratio ?? 1) || 1, 1);
  const unitKindRaw = String(product.unitRatioKind ?? "").trim();
  const cartonKindRaw = String(product.cartonRatioKind ?? "").trim();
  const hasStructured =
    isUnitRatioKind(unitKindRaw) ||
    isCartonRatioKind(cartonKindRaw) ||
    product.unitRatioValue != null ||
    product.cartonRatioValue != null;

  if (!hasStructured) {
    return {
      unitRatioKind: "Pcs",
      unitRatioValue: "1",
      cartonRatioKind: "Pcs/Ctn",
      cartonRatioValue: String(legacyRatio),
    };
  }

  return {
    unitRatioKind: isUnitRatioKind(unitKindRaw) ? unitKindRaw : "Pcs",
    unitRatioValue:
      product.unitRatioValue == null || product.unitRatioValue === ""
        ? "1"
        : String(product.unitRatioValue),
    cartonRatioKind: isCartonRatioKind(cartonKindRaw)
      ? cartonKindRaw
      : "Pcs/Ctn",
    cartonRatioValue:
      product.cartonRatioValue == null || product.cartonRatioValue === ""
        ? String(legacyRatio)
        : String(product.cartonRatioValue),
  };
}

export function packingCountFromProduct(value: unknown): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

export function parseRequiredPackingCount(
  value: string,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: `${label} is required` };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${label} must be a non-negative number` };
  }
  return { ok: true, value: n };
}

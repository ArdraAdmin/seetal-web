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

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Master category for an SHMP production product. Subcategory is the fallback. */
export function inventoryCategoryLabel(product: {
  category?: unknown;
  categoryName?: unknown;
  masterCategoryName?: unknown;
}): string {
  const direct = text(product.masterCategoryName) || text(product.categoryName);
  if (direct) return direct.split(" — ")[0].trim() || "Uncategorised";
  if (product.category && typeof product.category === "object") {
    const category = product.category as Record<string, unknown>;
    const master = text(category.masterCategoryName) || text(category.masterCategory);
    if (master) return master.split(" — ")[0].trim() || "Uncategorised";
    const sub = text(category.subCategory);
    if (sub) return sub;
  }
  if (typeof product.category === "string" && product.category.trim()) {
    return product.category.trim();
  }
  return "Uncategorised";
}

export function stockLineValue(product: ShmpStockProduct): number {
  const price = Number(product.sellingPrice) || 0;
  const ratio = Number(product.ratio);
  const piecesPerCarton = ratio > 0 ? ratio : 1;
  const cartons = Number(product.inQty?.amountInCartons) || 0;
  const loose = Number(product.inQty?.amountInUnits) || 0;
  return price * (cartons * piecesPerCarton + loose);
}

/** On-hand value of SHMP production stock, grouped by category. */
export function shmpInventoryCategoryRows(
  products: Array<
    ShmpStockProduct & {
      category?: unknown;
      categoryName?: unknown;
      masterCategoryName?: unknown;
    }
  >,
): SalesCategorySlice[] {
  const grouped = new Map<string, number>();
  for (const product of products) {
    const value = stockLineValue(product);
    if (value <= 0) continue;
    const label = inventoryCategoryLabel(product);
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

export function categorySliceTotal(rows: SalesCategorySlice[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0);
}

export type ShmpStockProduct = {
  _id?: string;
  productId?: string;
  source?: unknown;
  ownInventory?: unknown;
  sellingPrice?: number;
  ratio?: number;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
};

/** SKU count and stock value. Pass SHMP production products only. */
export function shmpStockSnapshot(products: ShmpStockProduct[]) {
  return {
    skus: products.length,
    value: products.reduce((sum, product) => sum + stockLineValue(product), 0),
  };
}

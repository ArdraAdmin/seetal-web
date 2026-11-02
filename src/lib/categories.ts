export interface CategoryRecord {
  _id?: string;
  masterCategoryId?: string;
  masterCategoryName?: string;
  subCategory?: string;
  awsMasterCatDir?: string;
  awsSubCatDir?: string;
  categoryManager?: string | { _id?: string; name?: string };
}

export interface CategoryGroup {
  name: string;
  masterCategoryId: string;
  awsMasterCatDir: string;
  items: CategoryRecord[];
}

export interface MasterCategoryRecord {
  _id?: string;
  masterCategoryId?: string;
  masterCategoryName?: string;
  awsMasterCatDir?: string;
  name?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseCategoryGroups(data: unknown): CategoryGroup[] {
  if (!Array.isArray(data)) return [];
  const groups: CategoryGroup[] = [];
  const flat = new Map<string, CategoryRecord[]>();

  for (const item of data) {
    const map = asRecord(item);
    if (!map) continue;
    if (map.subCategory && (map.masterCategoryName || map.masterCategoryId)) {
      const name = String(map.masterCategoryName || "Category");
      const list = flat.get(name) || [];
      list.push(map as CategoryRecord);
      flat.set(name, list);
      continue;
    }
    for (const [name, value] of Object.entries(map)) {
      if (!Array.isArray(value)) continue;
      groups.push({
        name,
        masterCategoryId: String(
          asRecord(value[0])?.masterCategoryId || "",
        ),
        awsMasterCatDir: String(asRecord(value[0])?.awsMasterCatDir || ""),
        items: uniqueCategories(value.filter(asRecord) as CategoryRecord[]),
      });
    }
  }

  if (groups.length === 0) {
    for (const [name, items] of flat.entries()) {
      groups.push({
        name,
        masterCategoryId: String(items[0]?.masterCategoryId || ""),
        awsMasterCatDir: String(items[0]?.awsMasterCatDir || ""),
        items: uniqueCategories(items),
      });
    }
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueCategories(items: CategoryRecord[]) {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const id = String(item._id || `${item.subCategory || ""}-${index}`);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function parseMasterCategories(data: unknown): MasterCategoryRecord[] {
  if (!Array.isArray(data)) return [];
  return data.filter(asRecord) as MasterCategoryRecord[];
}

export function slugDir(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "").replace(/^[a-z]/, (ch) =>
    ch.toUpperCase(),
  );
}

export function subcategoryDirectory(value: string) {
  return value.trim().replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
}

/** Body for POST /admin/category/create/sub. The API requires the master name. */
export function buildCreateSubCategoryBody(input: {
  masterCategoryId: string;
  masterCategoryName: string;
  subCategory: string;
  awsMasterCatDir: string;
}) {
  const subCategory = input.subCategory.trim();
  return {
    masterCategoryId: input.masterCategoryId.trim(),
    masterCategoryName: input.masterCategoryName.trim(),
    subCategory,
    awsMasterCatDir: input.awsMasterCatDir.trim(),
    awsSubCatDir: subcategoryDirectory(subCategory),
  };
}

export const PRODUCTS_LINKED_MESSAGE =
  "Products are linked to this category, so it cannot be deleted.";

function idText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (typeof value === "object") {
    const record = value as { toHexString?: () => string; _id?: unknown };
    if (typeof record.toHexString === "function") {
      const text = String(record.toHexString() || "").trim();
      if (text) return [text];
    }
    if ("_id" in record) return idText(record._id);
  }
  return [];
}

/** True when a product points at this master category or one of its subcategories. */
export function productIsLinkedToCategory(
  product: {
    category?: unknown;
    categoryId?: unknown;
    subCategoryId?: unknown;
    masterCategoryId?: unknown;
  },
  target: { categoryIds: readonly string[]; masterCategoryId?: string },
): boolean {
  const master = String(target.masterCategoryId || "").trim();
  if (master && String(product.masterCategoryId || "").trim() === master) {
    return true;
  }
  const ids = new Set(target.categoryIds.map((id) => id.trim()).filter(Boolean));
  if (ids.size === 0) return false;
  const refs = [
    ...idText(product.category),
    ...idText(product.categoryId),
    ...idText(product.subCategoryId),
  ];
  return refs.some((id) => ids.has(id));
}

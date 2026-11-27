export const CATEGORY_COMPANY_KEYS = ["stl", "shlaxmi", "sarvah"] as const;

export type CategoryCompanyKey = (typeof CATEGORY_COMPANY_KEYS)[number];

export interface CategoryRecord {
  _id?: string;
  masterCategoryId?: string;
  masterCategoryName?: string;
  subCategory?: string;
  awsMasterCatDir?: string;
  awsSubCatDir?: string;
  categoryManager?: string | { _id?: string; name?: string };
  /** Selling company. Missing values are treated as STL. */
  company?: string;
}

export interface CategoryGroup {
  name: string;
  masterCategoryId: string;
  awsMasterCatDir: string;
  items: CategoryRecord[];
  /** Selling company of the main category. Missing values are treated as STL. */
  company?: string;
}

export interface MasterCategoryRecord {
  _id?: string;
  masterCategoryId?: string;
  masterCategoryName?: string;
  awsMasterCatDir?: string;
  name?: string;
  company?: string;
}

/** A category with no company belongs to STL. */
export function categoryCompany(value: unknown): CategoryCompanyKey {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  return (CATEGORY_COMPANY_KEYS as readonly string[]).includes(key)
    ? (key as CategoryCompanyKey)
    : "stl";
}

export function categoryCompanyHref(key: CategoryCompanyKey) {
  return `/admin/categories/company/${key}`;
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

/** Put every main category on the list, including ones that have no subcategories yet. */
export function mergeCategoryGroups(
  groups: CategoryGroup[],
  masters: MasterCategoryRecord[],
): CategoryGroup[] {
  const merged: CategoryGroup[] = groups.map((group) => ({
    ...group,
    company: categoryCompany(group.company),
    items: group.items.map((item) => ({
      ...item,
      company: categoryCompany(item.company),
    })),
  }));

  for (const master of masters) {
    const id = String(master.masterCategoryId || "").trim();
    const name = String(master.masterCategoryName || master.name || "").trim();
    const company = categoryCompany(master.company);
    const existing = merged.find(
      (group) =>
        (id && group.masterCategoryId === id) || (name && group.name === name),
    );
    if (existing) {
      existing.company = company;
      if (id) existing.masterCategoryId = id;
      if (name) existing.name = name;
      if (!existing.awsMasterCatDir && master.awsMasterCatDir) {
        existing.awsMasterCatDir = master.awsMasterCatDir;
      }
      continue;
    }
    if (!id && !name) continue;
    merged.push({
      name: name || "Category",
      masterCategoryId: id,
      awsMasterCatDir: String(master.awsMasterCatDir || ""),
      company,
      items: [],
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Company pages show a main category when it belongs to that company,
 * and any of its subcategories that belong there.
 */
export function filterCategoryGroupsByCompany(
  groups: CategoryGroup[],
  company: CategoryCompanyKey | null,
): CategoryGroup[] {
  if (!company) return groups;
  return groups.flatMap((group) => {
    const items = group.items.filter(
      (item) => categoryCompany(item.company) === company,
    );
    if (categoryCompany(group.company) !== company && items.length === 0) {
      return [];
    }
    return [{ ...group, items }];
  });
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
  company?: string;
}) {
  const subCategory = input.subCategory.trim();
  return {
    masterCategoryId: input.masterCategoryId.trim(),
    masterCategoryName: input.masterCategoryName.trim(),
    subCategory,
    awsMasterCatDir: input.awsMasterCatDir.trim(),
    awsSubCatDir: subcategoryDirectory(subCategory),
    company: categoryCompany(input.company),
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

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

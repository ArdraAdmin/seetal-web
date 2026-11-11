import type { CategoryGroup } from "./categories";

type ShmpCategoryRow = {
  _id?: string;
  masterCategoryName?: string;
  subCategory?: string;
};

export function shmpCategoryGroups(rows: ShmpCategoryRow[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup>();
  for (const row of rows) {
    const name = row.masterCategoryName || "Category";
    const group = map.get(name) || {
      name,
      masterCategoryId: name,
      awsMasterCatDir: "",
      items: [],
    };
    group.items.push({
      _id: row._id,
      subCategory: row.subCategory,
      masterCategoryName: name,
    });
    map.set(name, group);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Search categories the same way the Seetal categories page does. */
export function filterCategoryGroups(
  groups: CategoryGroup[],
  query: string,
): CategoryGroup[] {
  const tag = query.trim().toLowerCase();
  if (!tag) return groups;
  return groups.flatMap((group) => {
    if (group.name.toLowerCase().includes(tag)) return [group];
    const items = group.items.filter((item) =>
      String(item.subCategory || "").toLowerCase().includes(tag),
    );
    if (items.length === 0) return [];
    return [{ ...group, items }];
  });
}

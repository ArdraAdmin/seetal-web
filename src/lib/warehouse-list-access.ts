export type WarehouseListFlags = {
  customs: boolean;
  loadList: boolean;
  zeroList: boolean;
};

/** Admin accounts see every list. A warehouse login only sees lists that are on. */
export function warehouseListAllowed(
  user: { role?: string | null; warehouseLists?: WarehouseListFlags | null } | null,
  tag: string,
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role !== "Warehouse") return false;
  const flags = user.warehouseLists;
  if (tag === "customs") return flags?.customs === true;
  if (tag === "daily") return flags?.zeroList === true;
  if (tag === "loading") return flags?.loadList === true;
  return false;
}

export function warehouseListFlagsFromRecord(
  warehouse: Record<string, unknown> | null,
): WarehouseListFlags {
  return {
    customs: warehouse?.customs === true,
    loadList: warehouse?.loadList === true,
    zeroList: warehouse?.zeroList === true,
  };
}


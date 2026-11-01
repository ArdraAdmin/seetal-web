export const BLOCKED_STORE_MESSAGE =
  "This store is blocked. You can't place orders.";

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function canonicalId(value: string) {
  const id = value.trim();
  return OBJECT_ID.test(id) ? id.toLowerCase() : id;
}

function objectIdText(value: object): string {
  const extended = (value as { $oid?: unknown }).$oid;
  if (typeof extended === "string" && OBJECT_ID.test(extended.trim())) {
    return canonicalId(extended);
  }
  const toHex = (value as { toHexString?: unknown }).toHexString;
  if (typeof toHex !== "function") return "";
  try {
    const hex = String(toHex.call(value)).trim();
    return OBJECT_ID.test(hex) ? canonicalId(hex) : "";
  } catch {
    return "";
  }
}

export function personId(value: unknown, depth = 0): string {
  if (typeof value === "string" || typeof value === "number") {
    return canonicalId(String(value));
  }
  if (!value || typeof value !== "object" || depth > 3) return "";
  const hex = objectIdText(value);
  if (hex) return hex;
  if ("_id" in value) return personId((value as { _id?: unknown })._id, depth + 1);
  return "";
}

export function salesPersonIdsFromStore(store: {
  salesPerson?: unknown;
  salesman?: unknown;
  salesPersons?: unknown;
}): string[] {
  const ids: string[] = [];
  const add = (value: unknown) => {
    const id = personId(value);
    if (id && !ids.includes(id)) ids.push(id);
  };
  if (Array.isArray(store.salesPersons)) {
    for (const person of store.salesPersons) add(person);
  }
  add(store.salesPerson);
  add(store.salesman);
  return ids;
}

export function storeAssignedToSalesman(
  store: {
    salesPerson?: unknown;
    salesman?: unknown;
    salesPersons?: unknown;
  },
  userId: string,
): boolean {
  const id = canonicalId(userId);
  if (!id) return false;
  return salesPersonIdsFromStore(store).includes(id);
}

export function storeOrderBlocked(store: { orderBlocked?: unknown }): boolean {
  return store.orderBlocked === true || store.orderBlocked === "true";
}

export function storesVisibleToSalesperson<
  T extends {
    salesPerson?: unknown;
    salesman?: unknown;
    salesPersons?: unknown;
  },
>(stores: T[], userId: string): T[] {
  if (!userId.trim()) return [];
  return stores.filter((store) => storeAssignedToSalesman(store, userId));
}

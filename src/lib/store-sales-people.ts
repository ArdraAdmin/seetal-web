/** Placeholder / junk sales accounts that must not appear on store forms. */
export const HIDDEN_STORE_SALES_PERSON_IDS = new Set([
  "5fc61c984438d90017ff7132",
]);

export function isHiddenStoreSalesPersonId(id: string) {
  return HIDDEN_STORE_SALES_PERSON_IDS.has(String(id || "").trim());
}

export function filterVisibleStoreSalesPeople<T extends { _id?: string }>(
  people: T[],
): T[] {
  return (people || []).filter(
    (person) => !isHiddenStoreSalesPersonId(String(person?._id || "")),
  );
}

export function filterVisibleStoreSalesPersonIds(ids: string[]) {
  return (ids || []).filter((id) => !isHiddenStoreSalesPersonId(id));
}

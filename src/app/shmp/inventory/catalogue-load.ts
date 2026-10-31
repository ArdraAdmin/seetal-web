/** Query for the SHMP production catalogue. Company id is required for a stable list. */
export function shmpCatalogueParams(search: string, companyId: string) {
  const params: Record<string, string> = {
    ownOnly: "1",
    excludeStl: "1",
  };
  const q = search.trim();
  if (q) params.q = q;
  if (companyId) params.companyId = companyId;
  return params;
}

/**
 * The page fires a new catalogue request when the company id arrives, and again
 * on refresh. Only the newest request may update the list. A slower earlier
 * response is a different product slice and was clearing the catalogue.
 */
export function catalogueRequestIsCurrent(
  requestId: number,
  activeRequestId: number,
  aborted: boolean,
) {
  return requestId === activeRequestId && !aborted;
}

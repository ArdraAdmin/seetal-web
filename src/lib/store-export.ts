export const STORE_EXPORT_HEADERS = [
  "Store name",
  "Marks",
  "Alias",
  "Phone",
  "Address line 1",
  "Address line 2",
  "Address line 3",
  "City",
  "Country",
  "Store code",
  "TRN",
  "Trade license expiry",
  "TRN document",
  "Trade license document",
  "EID number",
  "EID document",
  "Sales people",
  "Orders",
  "Temporary",
] as const;

export type StoreExportSource = {
  storeName?: string;
  name?: string;
  marks?: string;
  alias?: string;
  contactNumber?: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  city?: string;
  country?: string;
  uid?: string;
  trnNo?: string | number;
  tradeLicenseExpiry?: string | Date | null;
  trnDocumentUrl?: string;
  tradeLicenseDocumentUrl?: string;
  eidNumber?: string;
  eidDocumentFileName?: string;
  orderBlocked?: boolean;
  isTemp?: boolean;
  isTempStore?: boolean;
};

function cell(value: unknown) {
  return String(value ?? "").trim();
}

export function storeExportRow(
  store: StoreExportSource,
  salesPeople: string,
): Record<(typeof STORE_EXPORT_HEADERS)[number], string> {
  return {
    "Store name": cell(store.storeName || store.name),
    Marks: cell(store.marks),
    Alias: cell(store.alias),
    Phone: cell(store.contactNumber || store.mobileNumber),
    "Address line 1": cell(store.addressLine1),
    "Address line 2": cell(store.addressLine2),
    "Address line 3": cell(store.addressLine3),
    City: cell(store.city),
    Country: cell(store.country),
    "Store code": cell(store.uid),
    TRN: store.trnNo == null || store.trnNo === "" ? "" : String(store.trnNo),
    "Trade license expiry": cell(store.tradeLicenseExpiry).slice(0, 10),
    "TRN document": cell(store.trnDocumentUrl),
    "Trade license document": cell(store.tradeLicenseDocumentUrl),
    "EID number": cell(store.eidNumber),
    "EID document": cell(store.eidDocumentFileName),
    "Sales people": cell(salesPeople),
    Orders: store.orderBlocked ? "Blocked" : "Open",
    Temporary: store.isTemp || store.isTempStore ? "Yes" : "No",
  };
}

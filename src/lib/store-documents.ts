export type StoreDocumentFields = {
  trnDocument: File | null;
  tradeLicenseDocument: File | null;
  existingTrnUrl?: string;
  existingTradeLicenseUrl?: string;
  tradeLicenseExpiry: string;
};

export function hasStoreDocument(
  file: File | null | undefined,
  existingUrl?: string,
) {
  if (typeof File !== "undefined" && file instanceof File) return true;
  return Boolean(String(existingUrl ?? "").trim());
}

export function storeDocumentError(
  fields: StoreDocumentFields,
  mode: "create" | "edit",
  documentsPersist = true,
): string | null {
  if (!String(fields.tradeLicenseExpiry ?? "").trim()) {
    return "Enter a trade license expiry date";
  }

  const needFiles = mode === "create" || documentsPersist;
  if (!needFiles) return null;

  if (mode === "create") {
    if (!(typeof File !== "undefined" && fields.trnDocument instanceof File)) {
      return "Upload a TRN document";
    }
    if (
      !(
        typeof File !== "undefined" &&
        fields.tradeLicenseDocument instanceof File
      )
    ) {
      return "Upload a trade license document";
    }
    return null;
  }

  if (!hasStoreDocument(fields.trnDocument, fields.existingTrnUrl)) {
    return "Upload a TRN document";
  }
  if (
    !hasStoreDocument(
      fields.tradeLicenseDocument,
      fields.existingTradeLicenseUrl,
    )
  ) {
    return "Upload a trade license document";
  }
  return null;
}

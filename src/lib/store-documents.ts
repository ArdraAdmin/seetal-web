export type StoreDocumentFields = {
  trnDocument: File | null;
  tradeLicenseDocument: File | null;
  existingTrnUrl?: string;
  existingTradeLicenseUrl?: string;
  tradeLicenseExpiry: string;
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar date for a date input. Date-only strings stay as entered. */
export function tradeLicenseDateInput(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && DATE_ONLY.test(value.trim())) {
    return value.trim();
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTradeLicenseDate(value: unknown): string {
  const day = tradeLicenseDateInput(value);
  if (!day) return "";
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString();
}

/** Store the picked calendar day at 12:00 UTC so the date does not shift across time zones. */
export function parseTradeLicenseExpiryDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12),
    );
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = DATE_ONLY.exec(raw);
  if (!match) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(
      Date.UTC(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
        12,
      ),
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

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

/** Optional. Digits only, short enough to store as a number without rounding. */
export function storeTrnNumberError(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d{1,15}$/.test(raw)) return "Enter a valid TRN number";
  return null;
}

export const MAX_VEHICLE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_VEHICLE_DOCUMENTS = 20;
export const VEHICLE_FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/jpeg,image/png,image/webp";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const FILE_EXT = /\.(pdf|jpe?g|png|webp)$/i;

export type VehicleFieldInput = {
  vehicleNumber: unknown;
  purchaseYear: unknown;
  price: unknown;
  purchaseFrom: unknown;
  mulkyaExpiry: unknown;
  insurancePremium: unknown;
};

export type ParsedVehicleFields = {
  vehicleNumber: number;
  purchaseYear: number | null;
  price: number | null;
  purchaseFrom: string | null;
  mulkyaExpiry: string;
  insurancePremium: number;
};

export type UploadDraft = {
  name: string;
  type: string;
  size: number;
};

export type DocumentDraft = {
  name: string;
  file: UploadDraft | null;
};

export type VehicleFormCheck = VehicleFieldInput & {
  documents?: DocumentDraft[];
  savedDocumentCount?: number;
};

export type MaintenanceFormCheck = {
  title: unknown;
  amount: unknown;
  description: unknown;
  date: unknown;
  invoice: UploadDraft | null;
};

export type ParsedMaintenanceFields = {
  title: string;
  amount: number;
  description: string;
  date: string;
};

function sentenceLabel(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function optionalNumber(
  raw: unknown,
  label: string,
  opts?: { integer?: boolean; min?: number; max?: number },
): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Enter a valid ${label}`);
  }
  if (opts?.integer && !Number.isInteger(value)) {
    throw new Error(`${sentenceLabel(label)} must be a whole number`);
  }
  if (opts?.min != null && value < opts.min) {
    throw new Error(`${sentenceLabel(label)} must be at least ${opts.min}`);
  }
  if (opts?.max != null && value > opts.max) {
    throw new Error(`${sentenceLabel(label)} must be at most ${opts.max}`);
  }
  return value;
}

function optionalDate(raw: unknown, label: string): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const value = String(raw).trim().slice(0, 10);
  if (!DATE_ONLY.test(value)) {
    throw new Error(`Enter a valid ${label}`);
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Enter a valid ${label}`);
  }
  return value;
}

function requiredDate(raw: unknown, label: string): string {
  const value = optionalDate(raw, label);
  if (!value) throw new Error(`Enter a ${label}`);
  return value;
}

function requiredMoney(raw: unknown, label: string, emptyMessage: string): number {
  if (raw == null || String(raw).trim() === "") {
    throw new Error(emptyMessage);
  }
  const value = optionalNumber(raw, label, { min: 0 });
  if (value == null) throw new Error(emptyMessage);
  return value;
}

export function isAllowedVehicleFile(type: string, filename: string) {
  const mime = String(type || "").toLowerCase();
  if (
    mime === "application/pdf" ||
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp"
  ) {
    return true;
  }
  return FILE_EXT.test(filename);
}

const VIEWABLE_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function contentTypeForFile(type: string, filename: string) {
  const mime = String(type || "").split(";")[0].trim().toLowerCase();
  if (VIEWABLE_FILE_TYPES.has(mime)) return mime;
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export function viewableVehicleFileType(blobType: string, fileName: string) {
  const mime = String(blobType || "").split(";")[0].trim().toLowerCase();
  if (VIEWABLE_FILE_TYPES.has(mime)) return mime;
  return contentTypeForFile("", fileName);
}

export function vehicleObjectKey(originalName: string) {
  const base = String(originalName || "document").split(/[/\\]/).pop();
  const safe =
    String(base || "document")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "document";
  return `vehicle-files/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

export function isVehicleObjectKey(key: string) {
  return (
    /^vehicle-files\/\d+-[a-z0-9]+-[A-Za-z0-9._-]+$/.test(key) &&
    !key.includes("..")
  );
}

function fileRuleError(
  file: UploadDraft | null,
  messages: { missing: string; tooLarge: string; wrongType: string },
): string | null {
  if (!file || file.size <= 0) return messages.missing;
  if (file.size > MAX_VEHICLE_FILE_BYTES) return messages.tooLarge;
  if (!isAllowedVehicleFile(file.type, file.name)) return messages.wrongType;
  return null;
}

export function invoiceFileError(file: UploadDraft | null): string | null {
  return fileRuleError(file, {
    missing: "Upload an invoice",
    tooLarge: "Invoice must be 10 MB or smaller",
    wrongType: "Invoice must be a PDF, JPEG, PNG, or WebP file",
  });
}

export function documentFileError(
  file: UploadDraft | null,
  name: string,
): string | null {
  return fileRuleError(file, {
    missing: `Upload a file for ${name}`,
    tooLarge: `${name} must be 10 MB or smaller`,
    wrongType: `${name} must be a PDF, JPEG, PNG, or WebP file`,
  });
}

export function parseDocumentName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name) throw new Error("Name each document before uploading");
  if (name.length > 120) {
    throw new Error("Document names must be 120 characters or less");
  }
  return name;
}

export function parseVehicleNumber(raw: unknown): number {
  const vehicleNumber = Number(raw);
  if (!Number.isFinite(vehicleNumber)) {
    throw new Error("Enter a valid vehicle number");
  }
  return vehicleNumber;
}

export function parseVehicleFields(
  input: VehicleFieldInput,
  now = new Date(),
): ParsedVehicleFields {
  const vehicleNumber = parseVehicleNumber(input.vehicleNumber);
  const purchaseYear =
    input.purchaseYear == null || String(input.purchaseYear).trim() === ""
      ? null
      : optionalNumber(input.purchaseYear, "purchase year", {
          integer: true,
          min: 1980,
          max: now.getFullYear() + 1,
        });
  const price =
    input.price == null || String(input.price).trim() === ""
      ? null
      : optionalNumber(input.price, "price", { min: 0 });
  const purchaseFrom = String(input.purchaseFrom ?? "").trim();
  return {
    vehicleNumber,
    purchaseYear,
    price,
    purchaseFrom: purchaseFrom ? purchaseFrom.slice(0, 200) : null,
    mulkyaExpiry: requiredDate(input.mulkyaExpiry, "mulkya expiry"),
    insurancePremium: requiredMoney(
      input.insurancePremium,
      "insurance premium",
      "Enter an insurance premium",
    ),
  };
}

export function activeDocumentDrafts(rows: DocumentDraft[] | undefined) {
  return (rows ?? []).filter((row) => row.name.trim() || row.file);
}

export function vehicleFormError(
  input: VehicleFormCheck,
  now = new Date(),
): string | null {
  try {
    parseVehicleFields(input, now);
    const drafts = activeDocumentDrafts(input.documents);
    const saved = input.savedDocumentCount ?? 0;
    if (saved + drafts.length > MAX_VEHICLE_DOCUMENTS) {
      throw new Error("A vehicle can have at most 20 documents");
    }
    for (const row of drafts) {
      const name = parseDocumentName(row.name);
      const fileError = documentFileError(row.file, name);
      if (fileError) throw new Error(fileError);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Check the vehicle details";
  }
}

export function parseMaintenanceFields(input: {
  title: unknown;
  amount: unknown;
  description: unknown;
  date: unknown;
}): ParsedMaintenanceFields {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("Enter a maintenance title");
  if (input.amount == null || String(input.amount).trim() === "") {
    throw new Error("Enter a maintenance amount");
  }
  const amount = optionalNumber(input.amount, "amount", { min: 0 });
  if (amount == null) throw new Error("Enter a maintenance amount");
  return {
    title: title.slice(0, 160),
    amount,
    description: String(input.description ?? "").trim().slice(0, 2000),
    date: requiredDate(input.date, "maintenance date"),
  };
}

export function maintenanceFormError(input: MaintenanceFormCheck): string | null {
  try {
    parseMaintenanceFields(input);
    const fileError = invoiceFileError(input.invoice);
    if (fileError) throw new Error(fileError);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Check the maintenance details";
  }
}

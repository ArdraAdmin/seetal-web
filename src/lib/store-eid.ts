export const MAX_STORE_EID_FILE_BYTES = 10 * 1024 * 1024;

const FILE_EXT = /\.(pdf|jpe?g|png|webp)$/i;
const STORE_KEY =
  /^store-files\/[a-f0-9]{24}\/\d+-[a-z0-9]+-[A-Za-z0-9._-]+$/;

export type StoreEidFileDraft = {
  name: string;
  type: string;
  size: number;
};

export function isAllowedStoreEidFile(type: string, filename: string) {
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

export function storeEidFileError(file: StoreEidFileDraft | null): string | null {
  if (!file) return null;
  if (file.size <= 0) return "Choose an EID document";
  if (file.size > MAX_STORE_EID_FILE_BYTES) {
    return "EID document must be 10 MB or smaller";
  }
  if (!isAllowedStoreEidFile(file.type, file.name)) {
    return "EID document must be a PDF, JPEG, PNG, or WebP file";
  }
  return null;
}

export function storeEidNumberError(value: string): string | null {
  const number = value.trim();
  if (!number) return null;
  if (number.length > 40) return "EID number is too long";
  return null;
}

export function storeEidRequiredError(input: {
  eidNumber: string;
  file: StoreEidFileDraft | null;
  hasExistingDocument?: boolean;
}): string | null {
  if (!input.eidNumber.trim()) return "EID number is required";
  const numberError = storeEidNumberError(input.eidNumber);
  if (numberError) return numberError;
  if (input.file) return storeEidFileError(input.file);
  if (!input.hasExistingDocument) return "Upload an EID document";
  return null;
}

export function storeObjectKey(storeId: string, originalName: string) {
  const id = String(storeId || "").trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Store not found");
  const base = String(originalName || "document").split(/[/\\]/).pop();
  const safe =
    String(base || "document")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "document";
  return `store-files/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

export function isStoreObjectKey(key: string) {
  return STORE_KEY.test(key) && !key.includes("..");
}

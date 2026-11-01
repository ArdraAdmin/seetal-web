import {
  contentTypeForFile,
  documentFileError,
  invoiceFileError,
  parseDocumentName,
} from "../vehicle-records";

export type StoredUpload = {
  name: string;
  buffer: Buffer;
  fileName: string;
  contentType: string;
};

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || "document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").slice(0, 180);
  return cleaned || "document";
}

async function readFile(
  entry: FormDataEntryValue | null,
  errorFor: (file: { name: string; type: string; size: number } | null) => string | null,
): Promise<Omit<StoredUpload, "name">> {
  const file = entry instanceof File ? entry : null;
  const draft = file
    ? { name: file.name || "document", type: file.type || "", size: file.size }
    : null;
  const error = errorFor(draft);
  if (error || !file) throw new Error(error || "Choose a file");
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: safeFileName(file.name || "document"),
    contentType: contentTypeForFile(file.type || "", file.name || ""),
  };
}

export async function readInvoiceUpload(
  entry: FormDataEntryValue | null,
): Promise<Omit<StoredUpload, "name">> {
  return readFile(entry, invoiceFileError);
}

export async function readDocumentUploads(form: FormData): Promise<StoredUpload[]> {
  const names = form.getAll("documentName");
  const files = form.getAll("documentFile");
  if (names.length !== files.length) {
    throw new Error("Each document needs a name and a file");
  }
  const uploads: StoredUpload[] = [];
  for (let index = 0; index < names.length; index += 1) {
    const rawName = typeof names[index] === "string" ? names[index] : "";
    const entry = files[index] ?? null;
    const hasFile = entry instanceof File && entry.size > 0;
    if (!String(rawName).trim() && !hasFile) continue;
    const name = parseDocumentName(rawName);
    const file = await readFile(entry, (draft) => documentFileError(draft, name));
    uploads.push({ name, ...file });
  }
  return uploads;
}

export function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function formIdList(form: FormData, key: string) {
  return form
    .getAll(key)
    .flatMap((value) =>
      typeof value === "string" && value.trim() ? [value.trim()] : [],
    );
}

export function contentDisposition(fileName: string) {
  const cleaned = safeFileName(fileName).replace(/"/g, "");
  return `attachment; filename="${cleaned}"`;
}

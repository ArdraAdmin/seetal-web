import { describeApiError } from "./api-error-message";
import { getStoredAuth } from "./auth";
import {
  normalizeCompanyDocument,
  type CompanyDocumentPortal,
  type CompanyDocumentRecord,
} from "./company-documents";
import type { CustomCompanyKey } from "./custom-users";
import { noteRejectedSession } from "./session";

const REMOTE_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function apiBase(): string {
  return typeof window === "undefined" ? REMOTE_API_BASE : "/stl-api";
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  const sentToken = Boolean(user?.token);
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    cache: "no-store",
    headers,
  });
  if (sentToken) noteRejectedSession(res.status);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(describeApiError(body, text || res.statusText || "Request failed"), res.status);
  }
  return body as T;
}

function basePath(portal: CompanyDocumentPortal) {
  return portal === "shmp" ? "/shmp/company-documents" : "/admin/company-documents";
}

type PresignResponse = {
  uploadUrl?: string;
  key?: string;
  fileName?: string;
  contentType?: string;
  headers?: Record<string, string>;
};

function documentsFrom(body: unknown): CompanyDocumentRecord[] {
  const rows =
    body && typeof body === "object" && Array.isArray((body as { documents?: unknown }).documents)
      ? (body as { documents: unknown[] }).documents
      : [];
  return rows
    .map((row) => normalizeCompanyDocument(row))
    .filter((row): row is CompanyDocumentRecord => row !== null);
}

function documentFrom(body: unknown): CompanyDocumentRecord {
  const row =
    body && typeof body === "object" ? (body as { document?: unknown }).document : null;
  const document = normalizeCompanyDocument(row);
  if (!document) throw new ApiError("Document could not be read", 500);
  return document;
}

export async function listCompanyDocuments(
  portal: CompanyDocumentPortal,
  company?: CustomCompanyKey,
) {
  const query = company ? `?company=${encodeURIComponent(company)}` : "";
  return documentsFrom(await request(`${basePath(portal)}${query}`));
}

async function presign(
  portal: CompanyDocumentPortal,
  file: File,
  input: { company?: CustomCompanyKey; documentId?: string },
) {
  const intent = await request<PresignResponse>(`${basePath(portal)}/presign`, {
    method: "POST",
    body: JSON.stringify({
      company: input.company,
      documentId: input.documentId,
      fileName: file.name,
      size: file.size,
    }),
  });
  const uploadUrl = String(intent.uploadUrl || "").trim();
  const key = String(intent.key || "").trim();
  const fileName = String(intent.fileName || file.name).trim();
  const contentType = String(intent.contentType || "").trim();
  if (!uploadUrl || !key || !contentType) {
    throw new ApiError("Document upload could not be prepared", 500);
  }
  const headers = new Headers();
  const signed = intent.headers && typeof intent.headers === "object" ? intent.headers : {};
  for (const [header, value] of Object.entries(signed)) {
    if (value) headers.set(header, String(value));
  }
  if (!headers.has("Content-Type")) headers.set("Content-Type", contentType);
  if (!headers.has("x-amz-server-side-encryption")) {
    headers.set("x-amz-server-side-encryption", "AES256");
  }
  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, { method: "PUT", body: file, headers });
  } catch {
    throw new ApiError(
      "Could not upload the document to storage. If this keeps failing, S3 CORS may need PUT from this site.",
      0,
    );
  }
  if (!putRes.ok) {
    throw new ApiError(`Document storage upload failed (${putRes.status})`, putRes.status);
  }
  return { key, fileName };
}

export async function createCompanyDocument(
  portal: CompanyDocumentPortal,
  input: {
    company: CustomCompanyKey;
    title: string;
    hasExpiry: boolean;
    expiryDate: string;
    file: File;
  },
) {
  const uploaded = await presign(portal, input.file, { company: input.company });
  return documentFrom(
    await request(basePath(portal), {
      method: "POST",
      body: JSON.stringify({
        company: input.company,
        title: input.title,
        hasExpiry: input.hasExpiry,
        expiryDate: input.hasExpiry ? input.expiryDate : "",
        key: uploaded.key,
        fileName: uploaded.fileName,
      }),
    }),
  );
}

export async function updateCompanyDocument(
  portal: CompanyDocumentPortal,
  input: {
    id: string;
    title: string;
    hasExpiry: boolean;
    expiryDate: string;
    file?: File | null;
  },
) {
  const uploaded = input.file
    ? await presign(portal, input.file, { documentId: input.id })
    : null;
  return documentFrom(
    await request(`${basePath(portal)}/${encodeURIComponent(input.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: input.title,
        hasExpiry: input.hasExpiry,
        expiryDate: input.hasExpiry ? input.expiryDate : "",
        ...(uploaded ? { key: uploaded.key, fileName: uploaded.fileName } : {}),
      }),
    }),
  );
}

export async function deleteCompanyDocument(portal: CompanyDocumentPortal, id: string) {
  await request(`${basePath(portal)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

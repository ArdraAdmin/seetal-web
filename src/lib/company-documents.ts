import {
  CUSTOM_COMPANY_LABELS,
  SELLING_COMPANY_KEYS,
  moduleEnabled,
  type CustomAccess,
  type CustomCompanyKey,
} from "./custom-users";
import { shmpActionOn, type CompanyDocumentGrant, type SellingCompanyKey } from "./shmp-permissions";

export const MAX_DOCUMENT_MB = 25;
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

export type CompanyDocumentPortal = "selling" | "shmp";

export type CompanyDocumentRecord = {
  id: string;
  title: string;
  company: CustomCompanyKey;
  fileName: string;
  contentType: string;
  size: number;
  hasExpiry: boolean;
  expiryDate: string | null;
  uploadedAt: string | null;
  url: string;
};

export type CompanyDocumentPowers = {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

const FULL_POWERS: CompanyDocumentPowers = {
  create: true,
  read: true,
  update: true,
  delete: true,
};

export function documentFileError(file: { name: string; size: number }): string | null {
  const ext = file.name.toLowerCase().split(".").pop() || "";
  if (!file.name.includes(".") || !EXTENSIONS.has(ext)) {
    return "Upload a PDF, JPEG, PNG, WebP, Word, or Excel file";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "Document file is empty";
  if (file.size > MAX_DOCUMENT_BYTES) return `Document must be ${MAX_DOCUMENT_MB} MB or smaller`;
  return null;
}

export function formatDocumentSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function companiesForPortal(portal: CompanyDocumentPortal): CustomCompanyKey[] {
  return portal === "shmp" ? ["shmp"] : [...SELLING_COMPANY_KEYS];
}

export function companyDocumentLabel(company: CustomCompanyKey) {
  return CUSTOM_COMPANY_LABELS[company];
}

function sellingGrant(
  access: CustomAccess,
  company: SellingCompanyKey,
): CompanyDocumentGrant | null {
  if (!access.companies.includes(company) || !moduleEnabled(access, company, "my-company")) {
    return null;
  }
  return access.permissions?.sellingMyCompany?.[company] ?? null;
}

export function companyDocumentPowers(
  access: CustomAccess | null | undefined,
  portal: CompanyDocumentPortal,
  company: CustomCompanyKey,
): CompanyDocumentPowers {
  if (!companiesForPortal(portal).includes(company)) {
    return { create: false, read: false, update: false, delete: false };
  }
  if (!access) return { ...FULL_POWERS };
  if (portal === "shmp") {
    if (company !== "shmp") {
      return { create: false, read: false, update: false, delete: false };
    }
    return {
      create: shmpActionOn(access, "my-company", "create"),
      read: shmpActionOn(access, "my-company", "read"),
      update: shmpActionOn(access, "my-company", "update"),
      delete: shmpActionOn(access, "my-company", "delete"),
    };
  }
  if (company === "shmp") {
    return { create: false, read: false, update: false, delete: false };
  }
  const grant = sellingGrant(access, company);
  if (!access.companies.includes(company) || !moduleEnabled(access, company, "my-company")) {
    return { create: false, read: false, update: false, delete: false };
  }
  if (!grant) return { ...FULL_POWERS };
  return { ...grant.actions };
}

export function readableCompanies(
  access: CustomAccess | null | undefined,
  portal: CompanyDocumentPortal,
) {
  return companiesForPortal(portal).filter(
    (company) => companyDocumentPowers(access, portal, company).read,
  );
}

export function creatableCompanies(
  access: CustomAccess | null | undefined,
  portal: CompanyDocumentPortal,
) {
  return companiesForPortal(portal).filter(
    (company) => companyDocumentPowers(access, portal, company).create,
  );
}

export function expiryDateError(hasExpiry: boolean, value: string) {
  if (!hasExpiry) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Expiry date is required";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "Expiry date is invalid";
  }
  return null;
}

export function expiryStatus(hasExpiry: boolean, expiryDate: string | null, today: string) {
  if (!hasExpiry || !expiryDate) return { label: "No expiry", expired: false };
  if (expiryDate < today) return { label: `Expired ${expiryDate}`, expired: true };
  return { label: expiryDate, expired: false };
}

export function todayStamp(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeCompanyDocument(value: unknown): CompanyDocumentRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const company = String(row.company || "");
  if (company !== "stl" && company !== "sarvah" && company !== "shlaxmi" && company !== "shmp") {
    return null;
  }
  const id = String(row.id || "").trim();
  const title = String(row.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    company,
    fileName: String(row.fileName || "Document"),
    contentType: String(row.contentType || ""),
    size: Number(row.size) || 0,
    hasExpiry: row.hasExpiry === true,
    expiryDate: typeof row.expiryDate === "string" ? row.expiryDate : null,
    uploadedAt: typeof row.uploadedAt === "string" ? row.uploadedAt : null,
    url: typeof row.url === "string" ? row.url : "",
  };
}

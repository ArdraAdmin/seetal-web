import type { HrFileRef, HrProfile } from "./stl-features-api";

export type HrFileValue = HrFileRef | null;

export type HrProfileFormState = {
  visaName: string;
  visaDesignation: string;
  company: string;
  basicSalary: string;
  totalSalary: string;
  visaNumber: string;
  visaDetails: string;
  visaExpiry: string;
  visaApplicationYear: string;
  visaCost: string;
  passportNumber: string;
  passportExpiry: string;
  passportCopy: HrFileValue;
  eidNumber: string;
  eidExpiry: string;
  eidCopy: HrFileValue;
  visaCopy: HrFileValue;
  photo: HrFileValue;
  insuranceExpiry: string;
  insuranceCopy: HrFileValue;
  employmentContractCopy: HrFileValue;
  offerLetter: HrFileValue;
  sharjahPermitExpiry: string;
  sharjahPermitCopy: HrFileValue;
};

const FILE_KEYS = [
  "passportCopy",
  "eidCopy",
  "visaCopy",
  "photo",
  "insuranceCopy",
  "employmentContractCopy",
  "offerLetter",
  "sharjahPermitCopy",
] as const;

export function emptyHrProfileForm(): HrProfileFormState {
  return {
    visaName: "",
    visaDesignation: "",
    company: "",
    basicSalary: "",
    totalSalary: "",
    visaNumber: "",
    visaDetails: "",
    visaExpiry: "",
    visaApplicationYear: "",
    visaCost: "",
    passportNumber: "",
    passportExpiry: "",
    passportCopy: null,
    eidNumber: "",
    eidExpiry: "",
    eidCopy: null,
    visaCopy: null,
    photo: null,
    insuranceExpiry: "",
    insuranceCopy: null,
    employmentContractCopy: null,
    offerLetter: null,
    sharjahPermitExpiry: "",
    sharjahPermitCopy: null,
  };
}

export function toDateInput(value?: string | Date | null): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(parsed);
}

function fileFrom(value: unknown): HrFileValue {
  if (!value || typeof value !== "object") return null;
  const file = value as HrFileRef;
  if (!file.key) return null;
  return {
    key: file.key,
    fileName: file.fileName || "document",
    contentType: file.contentType,
    url: file.url,
  };
}

export function hrProfileToForm(
  profile?: HrProfile | null,
  fallbackName = "",
): HrProfileFormState {
  const form = emptyHrProfileForm();
  const source = profile || {};
  form.visaName = source.visaName || fallbackName;
  form.visaDesignation = source.visaDesignation || "";
  form.company = source.company ? String(source.company) : "";
  form.basicSalary = source.basicSalary != null ? String(source.basicSalary) : "";
  form.totalSalary = source.totalSalary != null ? String(source.totalSalary) : "";
  form.visaNumber = source.visaNumber || "";
  form.visaDetails = source.visaDetails || "";
  form.visaExpiry = toDateInput(source.visaExpiry);
  form.visaApplicationYear =
    source.visaApplicationYear != null ? String(source.visaApplicationYear) : "";
  form.visaCost = source.visaCost != null ? String(source.visaCost) : "";
  form.passportNumber = source.passportNumber || "";
  form.passportExpiry = toDateInput(source.passportExpiry);
  form.eidNumber = source.eidNumber || "";
  form.eidExpiry = toDateInput(source.eidExpiry);
  form.insuranceExpiry = toDateInput(source.insuranceExpiry);
  form.sharjahPermitExpiry = toDateInput(source.sharjahPermitExpiry);
  for (const key of FILE_KEYS) form[key] = fileFrom(source[key]);
  return form;
}

function numberOrBlank(value: string) {
  return value.trim() === "" ? "" : Number(value);
}

export function hrProfilePayload(form: HrProfileFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    visaName: form.visaName.trim(),
    visaDesignation: form.visaDesignation.trim(),
    company: form.company.trim(),
    basicSalary: numberOrBlank(form.basicSalary),
    totalSalary: numberOrBlank(form.totalSalary),
    visaNumber: form.visaNumber.trim(),
    visaDetails: form.visaDetails.trim(),
    visaExpiry: form.visaExpiry,
    visaApplicationYear: numberOrBlank(form.visaApplicationYear),
    visaCost: numberOrBlank(form.visaCost),
    passportNumber: form.passportNumber.trim(),
    passportExpiry: form.passportExpiry,
    eidNumber: form.eidNumber.trim(),
    eidExpiry: form.eidExpiry,
    insuranceExpiry: form.insuranceExpiry,
    sharjahPermitExpiry: form.sharjahPermitExpiry,
  };
  for (const key of FILE_KEYS) {
    const file = form[key];
    payload[key] = file
      ? { key: file.key, fileName: file.fileName, contentType: file.contentType }
      : null;
  }
  return payload;
}

export function validateHrProfileForm(form: HrProfileFormState): string | null {
  if (!form.visaName.trim()) return "Name as per visa is required";
  if (!form.visaDesignation.trim()) return "Designation as per visa is required";
  if (!form.passportNumber.trim()) return "Passport number is required";
  if (!form.passportExpiry) return "Passport expiry is required";
  if (!form.passportCopy?.key) return "Passport copy is required";
  if (!form.eidNumber.trim()) return "EID number is required";
  if (!form.eidExpiry) return "EID expiry is required";
  if (!form.eidCopy?.key) return "EID copy is required";
  if (!form.visaCopy?.key) return "Visa copy is required";
  if (!form.insuranceExpiry) return "Insurance expiry is required";
  if (!form.insuranceCopy?.key) return "Insurance copy is required";
  if (!form.employmentContractCopy?.key) return "Employment contract copy is required";
  const amounts = [
    ["Basic salary", form.basicSalary],
    ["Total salary", form.totalSalary],
    ["Visa cost", form.visaCost],
  ] as const;
  for (const [label, value] of amounts) {
    if (value.trim() === "") continue;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return `${label} must be a non-negative number`;
    }
  }
  return null;
}

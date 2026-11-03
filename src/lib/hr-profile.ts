import type { HrFileRef, HrProfile } from "./stl-features-api";

export type HrFileValue = HrFileRef | null;

export type HrSalaryScope = "stl" | "shmp";

export type HrProfileFormState = {
  visaName: string;
  visaDesignation: string;
  company: string;
  basicSalary: string;
  overtimeSalary: string;
  otherBenefits: string;
  totalSalary: string;
  sundayAllowance: string;
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
    overtimeSalary: "",
    otherBenefits: "",
    totalSalary: "",
    sundayAllowance: "",
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

function formatMoney(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function stlTotalSalary(
  form: Pick<HrProfileFormState, "basicSalary" | "otherBenefits">,
): string {
  const parts = [form.basicSalary, form.otherBenefits].map((value) => {
    if (value.trim() === "") return 0;
    return Number(value);
  });
  if (parts.some((amount) => !Number.isFinite(amount))) return "";
  return formatMoney(parts[0] + parts[1]);
}

function moneyText(value?: number | null): string {
  return value != null ? String(value) : "";
}

export function hrProfileToForm(
  profile?: HrProfile | null,
  fallbackName = "",
  scope?: HrSalaryScope,
): HrProfileFormState {
  const form = emptyHrProfileForm();
  const source = profile || {};
  form.visaName = source.visaName || fallbackName;
  form.visaDesignation = source.visaDesignation || "";
  form.company = source.company ? String(source.company) : "";
  form.basicSalary = moneyText(source.basicSalary);
  form.overtimeSalary = moneyText(source.overtimeSalary);
  form.otherBenefits = moneyText(source.otherBenefits);
  form.totalSalary = moneyText(source.totalSalary);
  if (scope === "stl") {
    if (form.otherBenefits === "" && source.totalSalary != null) {
      const derived = Number(source.totalSalary) - Number(source.basicSalary || 0);
      if (Number.isFinite(derived)) {
        form.otherBenefits = formatMoney(Math.max(0, derived));
      }
    }
    form.totalSalary = stlTotalSalary(form);
  }
  form.sundayAllowance =
    source.sundayAllowance != null ? String(source.sundayAllowance) : "";
  form.visaNumber = source.visaNumber || "";
  form.visaDetails = source.visaDetails || "";
  form.visaApplicationYear =
    source.visaApplicationYear != null ? String(source.visaApplicationYear) : "";
  form.visaCost = source.visaCost != null ? String(source.visaCost) : "";
  form.passportNumber = source.passportNumber || "";
  form.passportExpiry = toDateInput(source.passportExpiry);
  form.eidNumber = source.eidNumber || "";
  form.eidExpiry = toDateInput(source.eidExpiry);
  form.visaExpiry = form.eidExpiry || toDateInput(source.visaExpiry);
  form.insuranceExpiry = toDateInput(source.insuranceExpiry);
  form.sharjahPermitExpiry = toDateInput(source.sharjahPermitExpiry);
  for (const key of FILE_KEYS) form[key] = fileFrom(source[key]);
  return form;
}

function numberOrBlank(value: string) {
  return value.trim() === "" ? "" : Number(value);
}

export function hrProfilePayload(
  form: HrProfileFormState,
  scope?: HrSalaryScope,
): Record<string, unknown> {
  const company = form.company.trim();
  const payload: Record<string, unknown> = {
    visaName: form.visaName.trim(),
    visaDesignation: form.visaDesignation.trim(),
    ...(company ? { company } : {}),
    basicSalary: numberOrBlank(form.basicSalary),
    overtimeSalary: numberOrBlank(form.overtimeSalary),
    otherBenefits: numberOrBlank(form.otherBenefits),
    totalSalary: scope === "stl" ? numberOrBlank(stlTotalSalary(form)) : numberOrBlank(form.totalSalary),
    sundayAllowance: numberOrBlank(form.sundayAllowance),
    visaNumber: form.visaNumber.trim(),
    visaExpiry: form.eidExpiry || form.visaExpiry,
    visaApplicationYear: numberOrBlank(form.visaApplicationYear),
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

export function joiningDateError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Joined date is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return "Joined date is invalid";
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "Joined date is invalid";
  }
  return null;
}

export function validateHrProfileForm(
  form: HrProfileFormState,
  scope?: HrSalaryScope,
  shown?: {
    salary?: boolean;
    passport?: boolean;
    eid?: boolean;
    visa?: boolean;
    insurance?: boolean;
  },
  options?: { requireCompany?: boolean },
): string | null {
  if (!form.visaName.trim()) return "Name as per visa is required";
  if (!form.visaDesignation.trim()) return "Designation as per visa is required";
  if (options?.requireCompany && !form.company.trim()) return "Company is required";
  if (shown?.passport !== false) {
    if (!form.passportNumber.trim()) return "Passport number is required";
    if (!form.passportExpiry) return "Passport expiry is required";
    if (!form.passportCopy?.key) return "Passport copy is required";
  }
  if (shown?.eid !== false) {
    if (!form.eidNumber.trim()) return "EID number is required";
    if (!form.eidExpiry) return "EID expiry is required";
    if (!form.eidCopy?.key) return "EID copy is required";
  }
  if (shown?.visa !== false) {
    if (!form.visaNumber.trim()) return "Visa UID number is required";
    if (!form.visaCopy?.key) return "Visa copy is required";
  }
  if (shown?.insurance !== false) {
    if (!form.insuranceExpiry) return "Insurance expiry is required";
    if (!form.insuranceCopy?.key) return "Insurance copy is required";
    if (!form.employmentContractCopy?.key) return "Employment contract copy is required";
  }
  if (shown?.salary !== false && scope === "shmp") {
    if (form.basicSalary.trim() === "") return "Basic salary is required";
    if (form.totalSalary.trim() === "") return "Total salary is required";
  }
  if (shown?.salary !== false && scope === "stl") {
    if (form.basicSalary.trim() === "") return "Basic salary is required";
    if (form.otherBenefits.trim() === "") return "Other benefits is required";
  }
  const amounts = [
    ["Basic salary", form.basicSalary],
    ["Other benefits", form.otherBenefits],
    ["Total salary", form.totalSalary],
    ["Sunday allowance", form.sundayAllowance],
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

export function profileWithSharjahPermit(
  profile: HrProfile | null | undefined,
  expiry: string,
  file: HrFileValue,
  fallbackName = "",
  scope?: HrSalaryScope,
) {
  const form = hrProfileToForm(profile, fallbackName, scope);
  form.sharjahPermitExpiry = expiry;
  form.sharjahPermitCopy = file;
  return hrProfilePayload(form, scope);
}

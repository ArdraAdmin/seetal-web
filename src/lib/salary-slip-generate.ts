import { toSalarySlipPdfInput, type SalarySlipPersonRef } from "./salary-slip-map";
import {
  buildSalarySlipPdf,
  downloadSalarySlipPdf,
  salarySlipFilename,
  type SalarySlipPdfInput,
} from "./salary-slip-pdf";
import {
  getEmployeeHr,
  getHrStaffMember,
  getHrStaffRecord,
  getSalarySlip,
  type PayrollRegisterRow,
} from "./stl-features-api";

export type { SalarySlipPersonRef } from "./salary-slip-map";
export {
  absentDaysForPerson,
  skippedSalarySlipMessage,
  toSalarySlipPdfInput,
} from "./salary-slip-map";

export type GenerateSalarySlipsInput = {
  userId: string;
  year: number;
  month: number;
  people: SalarySlipPersonRef[];
  /** Kept for callers; slip layout no longer depends on register rows. */
  registerRows?: PayrollRegisterRow[];
  scope?: "stl" | "shmp";
};

export type GenerateSalarySlipsResult = {
  bytes: Uint8Array;
  filename: string;
  generated: number;
  skipped: Array<{ name: string; error: string }>;
};

async function resolveDesignation(userId: string, person: SalarySlipPersonRef) {
  const fromPerson = String(person.designation || "").trim();
  if (fromPerson) return fromPerson;
  try {
    if (person.kind === "staff") {
      const record = await getHrStaffRecord(userId, person.id);
      return String(record.hrProfile?.visaDesignation || record.role || "").trim();
    }
    if (person.kind === "employee") {
      const record = await getEmployeeHr(userId, person.id);
      return String(record.hrProfile?.visaDesignation || record.role || "").trim();
    }
    const record = await getHrStaffMember(userId, person.id);
    return String(record.hrProfile?.visaDesignation || record.role || "").trim();
  } catch {
    return "";
  }
}

export async function generateSalarySlipsPdf(
  input: GenerateSalarySlipsInput,
): Promise<GenerateSalarySlipsResult> {
  const people = input.people.filter((person) => person.id && person.kind);
  if (people.length === 0) {
    throw new Error("Select at least one person to generate a salary slip");
  }

  const pages: SalarySlipPdfInput[] = [];
  const skipped: Array<{ name: string; error: string }> = [];

  for (const person of people) {
    const label = person.name?.trim() || person.id;
    try {
      const slip = await getSalarySlip(
        input.userId,
        person.kind,
        person.id,
        input.year,
        input.month,
      );
      const designation = await resolveDesignation(input.userId, person);
      pages.push(
        toSalarySlipPdfInput(slip, {
          employeeName: person.name || slip.name,
          designation,
          code: person.code || "",
          group: person.group || "General",
        }),
      );
    } catch (err) {
      skipped.push({
        name: label,
        error: err instanceof Error ? err.message : "Failed to calculate salary",
      });
    }
  }

  if (pages.length === 0) {
    const detail = skipped.map((item) => `${item.name}: ${item.error}`).join("; ");
    throw new Error(detail || "Failed to generate salary slips");
  }

  const bytes = buildSalarySlipPdf(pages);
  const filename =
    pages.length === 1
      ? salarySlipFilename(input.year, input.month, pages[0]?.employeeName)
      : salarySlipFilename(input.year, input.month);

  return {
    bytes,
    filename,
    generated: pages.length,
    skipped,
  };
}

export async function downloadGeneratedSalarySlips(input: GenerateSalarySlipsInput) {
  const result = await generateSalarySlipsPdf(input);
  downloadSalarySlipPdf(result.bytes, result.filename);
  return result;
}

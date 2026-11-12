import type { PayrollRegisterRow, SalarySlip } from "./stl-features-api";
import type { SalarySlipPdfInput } from "./salary-slip-pdf";

export type SalarySlipPersonRef = {
  kind: "user" | "staff" | "employee";
  id: string;
  name?: string;
  companyId?: string;
  absentDays?: number;
  designation?: string;
  code?: string;
  group?: string;
};

export function absentDaysForPerson(
  person: SalarySlipPersonRef,
  registerRows?: PayrollRegisterRow[],
) {
  if (typeof person.absentDays === "number" && Number.isFinite(person.absentDays)) {
    return Math.max(0, person.absentDays);
  }
  const row = registerRows?.find((item) => item.id === person.id && item.kind === person.kind);
  if (row && typeof row.absentDays === "number" && Number.isFinite(row.absentDays)) {
    return Math.max(0, row.absentDays);
  }
  return 0;
}

export function toSalarySlipPdfInput(
  slip: SalarySlip,
  extras?: {
    designation?: string;
    code?: string;
    group?: string;
  },
): SalarySlipPdfInput {
  return {
    salaryMonth: slip.period.label,
    employeeName: slip.name,
    designation: extras?.designation || "",
    code: extras?.code || "",
    group: extras?.group || "General",
    basicSalary: slip.amounts.basicSalary,
    otWeekdays: slip.amounts.weekdayOt,
    otSundays: slip.amounts.sundayOt,
    otPublicHolidays: slip.amounts.publicHolidayOt,
    otherBenefits: slip.amounts.otherBenefits,
    totalSalary: slip.amounts.totalPayable,
  };
}

export function skippedSalarySlipMessage(skipped: Array<{ name: string; error: string }>) {
  if (skipped.length === 0) return "";
  if (skipped.length === 1) {
    return `Skipped ${skipped[0].name}: ${skipped[0].error}`;
  }
  return `Skipped ${skipped.length} people (${skipped
    .slice(0, 3)
    .map((item) => item.name)
    .join(", ")}${skipped.length > 3 ? ", …" : ""})`;
}

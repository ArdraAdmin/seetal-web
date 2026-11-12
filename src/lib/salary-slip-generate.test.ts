import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absentDaysForPerson,
  skippedSalarySlipMessage,
  toSalarySlipPdfInput,
} from "./salary-slip-map.ts";
import type { SalarySlip } from "./stl-features-api.ts";

const slip: SalarySlip = {
  name: "Sumesh Makhija",
  period: { year: 2026, month: 6, label: "June 2026" },
  attendance: {
    calendarDays: 30,
    totalLabel: "28 / 30",
    weekdaysWorked: "20",
    sundaysWorked: "2",
    publicHolidaysWorked: "0",
    sundayAllowanceDays: "2",
    weekdaysInMonth: 22,
    sundaysInMonth: 4,
    publicHolidaysInMonth: 1,
  },
  amounts: {
    basicSalary: 6000,
    weekdayOt: 100,
    sundayOt: 200,
    publicHolidayOt: 50,
    otherBenefits: 0,
    sundayAllowance: 0,
    totalPayable: 6350,
  },
  rates: {
    wageDays: 30,
    standardHours: 8,
    shiftHours: 9,
    breakHours: 1,
    actualHours: 8,
    extraHours: 1,
    weekdayMultiplier: 1.25,
    sundayMultiplier: 1.5,
    publicHolidayMultiplier: 2,
    sundayAllowancePerDay: 0,
    sundayAllowanceSource: "company",
    dailyBasicWage: 200,
    hourlyBasicWage: 25,
  },
  holidayLines: [],
};

describe("salary slip generate helpers", () => {
  it("prefers explicit absent days, then register row, then zero", () => {
    const rows = [
      {
        id: "p1",
        kind: "staff" as const,
        name: "A",
        absentDays: 3,
        presentDays: 27,
        leaveDays: 0,
        basicSalary: 0,
        otherBenefits: 0,
        otSundays: 0,
        totalSalary: 0,
        food: 0,
        finalPay: 0,
      },
    ];
    assert.equal(absentDaysForPerson({ kind: "staff", id: "p1", absentDays: 1 }, rows), 1);
    assert.equal(absentDaysForPerson({ kind: "staff", id: "p1" }, rows), 3);
    assert.equal(absentDaysForPerson({ kind: "employee", id: "p1" }, rows), 0);
    assert.equal(absentDaysForPerson({ kind: "staff", id: "missing" }, rows), 0);
  });

  it("maps calculated slip amounts into pdf input with fixed group default", () => {
    assert.deepEqual(toSalarySlipPdfInput(slip, { designation: "Sales" }), {
      salaryMonth: "June 2026",
      employeeName: "Sumesh Makhija",
      designation: "Sales",
      code: "",
      group: "General",
      basicSalary: 6000,
      otWeekdays: 100,
      otSundays: 200,
      otPublicHolidays: 50,
      otherBenefits: 0,
      totalSalary: 6350,
    });
  });

  it("summarizes skipped people for toasts", () => {
    assert.equal(skippedSalarySlipMessage([]), "");
    assert.equal(
      skippedSalarySlipMessage([{ name: "Ahmed", error: "offline" }]),
      "Skipped Ahmed: offline",
    );
    assert.match(
      skippedSalarySlipMessage([
        { name: "A", error: "x" },
        { name: "B", error: "y" },
        { name: "C", error: "z" },
        { name: "D", error: "w" },
      ]),
      /Skipped 4 people \(A, B, C, …\)/,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  foodRateFromCharge,
  linkedAttendanceDays,
  onePayrollRowPerPerson,
  standardFoodCharge,
} from "./payroll-edit.ts";

describe("payroll edit", () => {
  it("turns a typed food charge back into the monthly rate", () => {
    assert.equal(standardFoodCharge(230, 31, 1), 222.58);
    assert.equal(foodRateFromCharge(222.58, 31, 1), 230);
    assert.equal(foodRateFromCharge(310, 31, 0), 310);
  });

  it("lists a person once when production adds a second payroll row", () => {
    const rows = onePayrollRowPerPerson([
      {
        id: "staff-1",
        kind: "staff",
        name: "Abhishek Verma Uma Shankar Verma",
        basicSalary: 800,
      },
      {
        id: "emp-1",
        kind: "employee",
        name: "Abhishek Verma Uma Shankar Verma",
        basicSalary: 0,
      },
      { id: "emp-2", kind: "employee", name: "Other Worker", basicSalary: 900 },
    ]);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["staff-1", "emp-2"],
    );
  });

  it("keeps present and absent days on the calendar", () => {
    assert.deepEqual(linkedAttendanceDays(20, 31), { presentDays: 20, absentDays: 11 });
    assert.deepEqual(linkedAttendanceDays(-2, 30), { presentDays: 0, absentDays: 30 });
  });
});
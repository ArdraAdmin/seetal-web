import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPayrollFoodSplit,
  currentPayrollMonth,
  foodRateFromCharge,
  linkedAttendanceDays,
  onePayrollRowPerPerson,
  payrollFoodPeople,
  payrollGrandTotal,
  splitPayrollMoney,
  payrollFoodFreeDays,
  standardFoodCharge,
} from "./payroll-edit.ts";

describe("payroll edit", () => {
  it("opens payroll on the current Dubai month", () => {
    assert.equal(currentPayrollMonth(new Date("2026-11-11T08:00:00.000Z")), "2026-11");
    assert.equal(currentPayrollMonth(new Date("2026-10-31T20:30:00.000Z")), "2026-11");
    assert.equal(currentPayrollMonth(new Date("2026-10-31T18:00:00.000Z")), "2026-10");
  });

  it("turns a typed food charge back into the monthly rate", () => {
    assert.equal(standardFoodCharge(230, 31, 1), 222.58);
    assert.equal(foodRateFromCharge(222.58, 31, 1), 230);
    assert.equal(foodRateFromCharge(310, 31, 0), 310);
    assert.equal(payrollFoodFreeDays(1, 2), 3);
    assert.equal(standardFoodCharge(230, 31, payrollFoodFreeDays(0, 1)), 222.58);
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

  it("splits a food total so the shares add back up", () => {
    assert.deepEqual(splitPayrollMoney(100.01, 3), [33.34, 33.34, 33.33]);
    const rows = applyPayrollFoodSplit([
      { food: 230, foodChargeable: true, finalPay: 1000, totalSalary: 1230 },
      { food: 210, foodChargeable: true, finalPay: 400, totalSalary: 610 },
      { food: 0, foodChargeable: false, finalPay: 800, totalSalary: 800 },
    ], { mode: "total", amount: 100.01 });
    assert.equal(rows[0].food, 50.01);
    assert.equal(rows[1].food, 50);
    assert.equal(rows[2].finalPay, 800);
    assert.equal(payrollGrandTotal(rows).finalPay, 2539.99);
    assert.equal(payrollFoodPeople(rows), 2);
  });

  it("keeps present and absent days on the calendar", () => {
    assert.deepEqual(linkedAttendanceDays(20, 31), { presentDays: 20, absentDays: 11 });
    assert.deepEqual(linkedAttendanceDays(-2, 30), { presentDays: 0, absentDays: 30 });
  });
});
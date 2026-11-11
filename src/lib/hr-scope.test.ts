import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRecordUserId,
  addedHrStaffOnly,
  hrPeopleMissingFromAttendance,
  productionShadowEmployees,
  isShmpAttendancePortalRole,
  isStlHrRole,
  presentRowVisibleToCaller,
  presentRowVisibleToSupervisor,
  stlAttendanceLoginId,
  stlHrPeopleForAttendance,
  warehouseStaffLabel,
} from "./hr-scope.ts";

describe("HR people filters", () => {
  it("limits STL to warehouse staff", () => {
    assert.equal(isStlHrRole("Warehouse"), true);
    assert.equal(isStlHrRole("Sales"), false);
    assert.equal(isStlHrRole("Supervisor"), false);
    assert.equal(isStlHrRole("Admin"), false);
    assert.equal(isStlHrRole(""), false);
  });

  it("shows only people added as staff on the HR list", () => {
    const rows = addedHrStaffOnly([
      { id: "sales", kind: "user", role: "Sales" },
      { id: "supervisor", kind: "user", role: "Supervisor" },
      { id: "worker", kind: "employee", role: "Worker" },
      { id: "staff", kind: "staff", role: "Sales" },
    ]);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["staff"],
    );
  });

  it("adds HR people who are not already on the attendance list", () => {
    const missing = hrPeopleMissingFromAttendance(
      [
        { id: "staff-supervisor", name: "Amina", linkedUserId: "user-1" },
        { id: "staff-sales", name: "Ravi", linkedUserId: "user-2" },
        { id: "staff-only", name: "Noor", linkedUserId: null },
        { id: "staff-same-name", name: "Worker One", linkedUserId: null },
      ],
      [
        { id: "user-1", name: "Amina" },
        { id: "worker-1", name: "Worker One" },
      ],
    );
    assert.deepEqual(
      missing.map((row) => row.id),
      ["staff-sales", "staff-only"],
    );
  });

  it("keeps a production worker on the HR attendance list", () => {
    const employees = [
      { _id: "emp-new", name: "Abhishek Verma Uma Shankar Verma", hrStaffId: "staff-1" },
      { _id: "emp-real", name: "Other Worker" },
    ];
    const hr = [
      {
        id: "staff-1",
        name: "Abhishek Verma Uma Shankar Verma",
        productionWorker: true,
        productionEmployeeId: "emp-new",
      },
      { id: "staff-2", name: "Other Worker", productionWorker: false },
    ];
    const shadows = productionShadowEmployees(employees, hr);
    assert.deepEqual(
      shadows.map((row) => row._id),
      ["emp-new"],
    );
    const shadowIds = new Set(shadows.map((row) => row._id));
    const listed = employees.filter((row) => !shadowIds.has(row._id));
    const missing = hrPeopleMissingFromAttendance(
      hr,
      listed.map((row) => ({ id: row._id, name: row.name })),
    );
    assert.deepEqual(
      missing.map((row) => row.id),
      ["staff-1"],
    );
  });

  it("treats a production employee with the same name as the staff record", () => {
    const shadows = productionShadowEmployees(
      [{ _id: "emp-new", name: "  Anil Kumar Yadav  " }],
      [{ id: "staff-1", name: "Anil Kumar Yadav", productionWorker: true }],
    );
    assert.deepEqual(
      shadows.map((row) => row._id),
      ["emp-new"],
    );
  });

  it("limits SHMP attendance portal check-ins to supervisors", () => {
    assert.equal(isShmpAttendancePortalRole("Supervisor"), true);
    assert.equal(isShmpAttendancePortalRole("Sales"), false);
    assert.equal(isShmpAttendancePortalRole("Warehouse"), false);
  });

  it("uses the STL HR roster for attendance", () => {
    const rows = stlHrPeopleForAttendance([
      { id: "wh", kind: "user", role: "Warehouse" },
      { id: "sales", kind: "user", role: "Sales" },
      { id: "staff", kind: "staff", role: "Sales", linkedUserId: "linked" },
    ]);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["wh", "staff"],
    );
    assert.equal(stlAttendanceLoginId(rows[0]), "wh");
    assert.equal(stlAttendanceLoginId(rows[1]), "linked");
    assert.equal(
      stlAttendanceLoginId({ id: "staff2", kind: "staff", linkedUserId: null }),
      "",
    );
  });

  it("lets supervisors see workers and supervisors only", () => {
    assert.equal(
      presentRowVisibleToSupervisor({ kind: "worker", role: "Worker" }),
      true,
    );
    assert.equal(
      presentRowVisibleToSupervisor({ kind: "portal", role: "Supervisor" }),
      true,
    );
    assert.equal(
      presentRowVisibleToSupervisor({ kind: "portal", role: "Sales" }),
      false,
    );
    assert.equal(
      presentRowVisibleToCaller({ kind: "portal", role: "Sales" }, false),
      false,
    );
    assert.equal(
      presentRowVisibleToCaller({ kind: "portal", role: "Supervisor" }, false),
      true,
    );
    assert.equal(
      presentRowVisibleToCaller({ kind: "portal", role: "Sales" }, true),
      false,
    );
  });

  it("labels warehouse managers separately from warehouse users", () => {
    assert.equal(warehouseStaffLabel(true), "Warehouse manager");
    assert.equal(warehouseStaffLabel(false), "Warehouse user");
  });

  it("reads the user id from an attendance record", () => {
    assert.equal(attendanceRecordUserId("abc"), "abc");
    assert.equal(attendanceRecordUserId({ _id: "xyz" }), "xyz");
    assert.equal(attendanceRecordUserId(null), "");
    assert.equal(attendanceRecordUserId(undefined), "");
  });
});

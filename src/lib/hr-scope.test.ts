import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRecordUserId,
  addedHrStaffOnly,
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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceRecordUserId,
  isShmpHrPortalRole,
  isStlHrRole,
  presentRowVisibleToCaller,
  presentRowVisibleToSupervisor,
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

  it("limits SHMP portal people to sales and supervisors", () => {
    assert.equal(isShmpHrPortalRole("Sales"), true);
    assert.equal(isShmpHrPortalRole("Supervisor"), true);
    assert.equal(isShmpHrPortalRole("Admin"), false);
    assert.equal(isShmpHrPortalRole("Warehouse"), false);
    assert.equal(isShmpHrPortalRole("Worker"), false);
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

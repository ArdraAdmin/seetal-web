import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  homePathForEnvironment,
  SUPERVISOR_SHMP_HOME,
} from "./environment.ts";
import { canSupervisorAccessShmpPath } from "./supervisor-shmp-access.ts";

describe("supervisor SHMP routes", () => {
  it("sends supervisors to attendance, not HR", () => {
    assert.equal(SUPERVISOR_SHMP_HOME, "/shmp/attendance");
    assert.equal(
      homePathForEnvironment("shmp", "Supervisor"),
      "/shmp/attendance",
    );
  });

  it("hides the HR module while keeping person pages from attendance", () => {
    assert.equal(canSupervisorAccessShmpPath("/shmp/hr"), false);
    assert.equal(canSupervisorAccessShmpPath("/shmp/hr/worker/w1"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp/hr/user/s1"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp/attendance"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp/production"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp/orders"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp/delivery"), true);
    assert.equal(canSupervisorAccessShmpPath("/shmp"), false);
  });
});

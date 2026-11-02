import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseReturnTo,
  parseUserGroup,
  readAccessPeople,
  readWorkers,
  userManagementPath,
  withReturnTo,
} from "./user-management.ts";

describe("user management groups", () => {
  it("defaults each side to its first group", () => {
    assert.equal(parseUserGroup("admin", null), "sales");
    assert.equal(parseUserGroup("shmp", ""), "supervisor");
    assert.equal(parseUserGroup("admin", "warehouse"), "warehouse");
    assert.equal(parseUserGroup("shmp", "workers"), "workers");
  });

  it("rejects a group that belongs to the other side", () => {
    assert.equal(parseUserGroup("admin", "supervisor"), "sales");
    assert.equal(parseUserGroup("shmp", "sales"), "supervisor");
    assert.equal(parseUserGroup("admin", "custom"), "custom");
  });

  it("allows only user-management return paths", () => {
    assert.equal(
      parseReturnTo(userManagementPath("admin", "sales")),
      "/admin/users?group=sales",
    );
    assert.equal(
      parseReturnTo("/shmp/users?group=workers"),
      "/shmp/users?group=workers",
    );
    assert.equal(parseReturnTo("/admin/users?group=supervisor"), null);
    assert.equal(parseReturnTo("https://example.com"), null);
    assert.equal(parseReturnTo("/admin/profiles/sales"), null);
  });

  it("appends a return path without dropping existing query params", () => {
    assert.equal(
      withReturnTo("/admin/profiles/sales/new", "/admin/users?group=sales"),
      "/admin/profiles/sales/new?returnTo=%2Fadmin%2Fusers%3Fgroup%3Dsales",
    );
    assert.equal(
      withReturnTo("/shmp/hr/user/1?edit=1", "/shmp/users?group=supervisor"),
      "/shmp/hr/user/1?edit=1&returnTo=%2Fshmp%2Fusers%3Fgroup%3Dsupervisor",
    );
  });
});

describe("directory people", () => {
  it("keeps supervisors and drops other roles", () => {
    const people = readAccessPeople(
      [
        { _id: "1", name: "Asha", email: "a@example.com", role: "Supervisor" },
        { _id: "2", name: "Ravi", role: "Sales" },
        { name: "Missing id", role: "Supervisor" },
      ],
      "Supervisor",
    );
    assert.deepEqual(people, [
      {
        id: "1",
        name: "Asha",
        email: "a@example.com",
        mobile: "",
        detail: "Supervisor",
      },
    ]);
  });

  it("reads workers from a wrapped list and skips inactive rows", () => {
    const people = readWorkers({
      employees: [
        {
          _id: "w2",
          name: "Zara",
          designation: "Helper",
          defaultShift: "night",
          mobileNumber: "050",
        },
        { _id: "w1", name: "Ali", isActive: false },
      ],
    });
    assert.deepEqual(people, [
      {
        id: "w2",
        name: "Zara",
        email: "",
        mobile: "050",
        detail: "Helper · Night",
      },
    ]);
  });
});

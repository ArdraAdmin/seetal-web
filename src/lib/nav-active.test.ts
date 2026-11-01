import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navItemActive } from "./nav-active.ts";

const items = [
  { href: "/admin" },
  { href: "/admin/hr" },
  { href: "/admin/hr/payroll" },
];

describe("nav item active state", () => {
  it("highlights only the payroll item on the payroll page", () => {
    assert.equal(navItemActive(items[0], "/admin/hr/payroll", items, "/admin"), false);
    assert.equal(navItemActive(items[1], "/admin/hr/payroll", items, "/admin"), false);
    assert.equal(navItemActive(items[2], "/admin/hr/payroll", items, "/admin"), true);
  });

  it("highlights HR on a staff record and the dashboard only on its own page", () => {
    assert.equal(navItemActive(items[1], "/admin/hr/staff/abc", items, "/admin"), true);
    assert.equal(navItemActive(items[2], "/admin/hr/staff/abc", items, "/admin"), false);
    assert.equal(navItemActive(items[0], "/admin", items, "/admin"), true);
    assert.equal(navItemActive(items[1], "/admin", items, "/admin"), false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogItemAllowed,
  grantWhenEnabled,
  permissionsForEditor,
  productionOrderAllowed,
  sanitizeShmpPermissions,
  sessionCustomAccess,
  shmpActionOn,
  shmpFieldOn,
  shmpModuleAllowed,
  shmpRecordAllowed,
} from "./shmp-permissions.ts";

const legacy = {
  companies: ["shmp"],
  modules: { shmp: ["dashboard", "hr", "hr:salary", "inventory"] },
};

describe("SHMP permission grants", () => {
  it("keeps full access for accounts that have not been saved with explicit grants", () => {
    assert.equal(shmpModuleAllowed(legacy, "payroll"), true);
    assert.equal(shmpModuleAllowed(legacy, "categories"), true);
    assert.equal(shmpModuleAllowed(legacy, "approvals"), true);
    assert.equal(shmpActionOn(legacy, "stores", "block"), false);
    assert.equal(shmpActionOn(legacy, "hr", "delete"), true);
    assert.equal(shmpFieldOn(legacy, "hr", "basicSalary"), true);
    assert.equal(shmpFieldOn(legacy, "hr", "passportNumber"), false);
    assert.equal(shmpFieldOn(legacy, "hr", "email"), true);
    assert.equal(shmpRecordAllowed(legacy, "hr", "users", "person-1"), true);
  });

  it("does not grant payroll when salary was turned off on an older account", () => {
    const limited = {
      companies: ["shmp"],
      modules: { shmp: ["hr", "hr:passport"] },
    };
    assert.equal(shmpModuleAllowed(limited, "payroll"), false);
    assert.equal(shmpFieldOn(limited, "hr", "basicSalary"), false);
    assert.equal(shmpFieldOn(limited, "hr", "passportNumber"), true);
    assert.equal(shmpFieldOn(limited, "hr", "email"), true);
  });

  it("treats explicit actions, fields, and records independently", () => {
    const saved = sanitizeShmpPermissions({
      version: 1,
      shmp: {
        hr: {
          actions: { create: false, read: true, update: false, delete: true },
          fields: { email: true, basicSalary: false },
          users: { mode: "selected", ids: ["a"] },
        },
        approvals: { read: true, approve: false },
        stores: { actions: { read: true }, block: false, fields: { storeName: true } },
        catalog: {
          actions: { read: true },
          items: { mode: "selected", ids: ["item-1", "item-2"] },
          uploadImages: false,
        },
        inventory: {
          actions: { read: true },
          items: { mode: "selected", ids: ["item-2"] },
          fields: { sellingPrice: true },
        },
        production: {
          orders: { mode: "stores", ids: ["store-1"] },
          logs: false,
          cards: { "today-cartons": true, "today-value": false },
        },
      },
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    const access = {
      companies: ["shmp"],
      modules: {
        shmp: ["hr", "approvals", "stores", "catalog", "inventory", "production"],
      },
      explicit: true,
      permissions: saved.permissions,
    };
    assert.equal(shmpActionOn(access, "hr", "read"), true);
    assert.equal(shmpActionOn(access, "hr", "create"), false);
    assert.equal(shmpActionOn(access, "hr", "delete"), true);
    assert.equal(shmpActionOn(access, "approvals", "approve"), false);
    assert.equal(shmpActionOn(access, "stores", "block"), false);
    assert.equal(shmpActionOn(access, "catalog", "uploadImages"), false);
    assert.equal(shmpFieldOn(access, "hr", "email"), true);
    assert.equal(shmpFieldOn(access, "hr", "basicSalary"), false);
    assert.equal(shmpFieldOn(access, "hr", "salary"), false);
    assert.equal(shmpRecordAllowed(access, "hr", "users", "a"), true);
    assert.equal(shmpRecordAllowed(access, "hr", "users", "b"), false);
    assert.equal(catalogItemAllowed(access, "item-1"), false);
    assert.equal(catalogItemAllowed(access, "item-2"), true);
    assert.equal(shmpFieldOn(access, "production", "today-cartons"), true);
    assert.equal(shmpFieldOn(access, "production", "today-value"), false);
    assert.equal(shmpActionOn(access, "production", "logs"), false);
    assert.equal(productionOrderAllowed(access, { _id: "order-1", store: "store-1" }), true);
    assert.equal(productionOrderAllowed(access, { _id: "order-2", store: "store-2" }), false);
    assert.equal(shmpModuleAllowed(access, "payroll"), false);
  });

  it("starts a newly enabled module with read on and other actions off", () => {
    const hr = grantWhenEnabled("hr");
    assert.equal("actions" in hr && hr.actions.read, true);
    assert.equal("actions" in hr && hr.actions.create, false);
    const approvals = grantWhenEnabled("approvals");
    assert.equal("approve" in approvals && approvals.approve, false);
    assert.equal("read" in approvals && approvals.read, true);
  });

  it("lets production assign every worker until a user list is saved", () => {
    const saved = sanitizeShmpPermissions({
      version: 1,
      shmp: {
        production: {
          orders: { mode: "all" },
          logs: false,
          cards: { "today-cartons": true },
        },
      },
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.permissions.shmp.production?.users.mode, "all");

    const limited = sanitizeShmpPermissions({
      version: 1,
      shmp: {
        production: {
          orders: { mode: "all" },
          logs: false,
          cards: {},
          users: { mode: "selected", ids: ["worker-1", "worker-1"] },
        },
      },
    });
    assert.equal(limited.ok, true);
    if (!limited.ok) return;
    assert.deepEqual(limited.permissions.shmp.production?.users, {
      mode: "selected",
      ids: ["worker-1"],
    });
    const access = {
      companies: ["shmp"],
      modules: { shmp: ["production"] },
      explicit: true,
      permissions: limited.permissions,
    };
    assert.equal(shmpRecordAllowed(access, "production", "users", "worker-1"), true);
    assert.equal(shmpRecordAllowed(access, "production", "users", "worker-2"), false);
    const cookie = sessionCustomAccess(access);
    assert.deepEqual(cookie.permissions?.shmp.production?.users, {
      mode: "selected",
      ids: [],
    });

    const older = {
      companies: ["shmp"],
      modules: { shmp: ["production"] },
      explicit: true,
      permissions: {
        version: 1 as const,
        shmp: {
          production: {
            orders: { mode: "all" as const },
            logs: false,
            cards: { "today-cartons": true },
            users: undefined as unknown as { mode: "all" },
          },
        },
      },
    };
    assert.equal(shmpRecordAllowed(older, "production", "users", "worker-2"), true);
    assert.equal(permissionsForEditor(older).shmp.production?.users.mode, "all");
    const enabled = grantWhenEnabled("production");
    assert.equal("users" in enabled && enabled.users.mode, "all");
  });

  it("shows an older account as fully enabled until it is saved", () => {
    const draft = permissionsForEditor(legacy);
    assert.equal(draft.shmp.hr?.actions.delete, true);
    assert.equal(draft.shmp.payroll?.edit, true);
    assert.equal(draft.shmp.categories?.actions.read, true);
  });
});

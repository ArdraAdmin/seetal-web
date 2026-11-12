import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newFleetGrant } from "./shmp-permissions.ts";
import {
  apiModuleKeysForAccess,
  canCustomUserAccessPath,
  customUserRestrictedPath,
  companyKeyFromRecord,
  customHomePath,
  companiesOfferedToEditor,
  environmentsForAccess,
  filterCompaniesForModule,
  firstAllowedPath,
  fleetActionOn,
  fleetRecordOn,
  permissionsPayloadForSave,
  portalFieldVisible,
  readCustomAccess,
  moduleFields,
  sanitizeCustomAccess,
  sellingFleetForEditor,
  sellingModuleVisible,
  sideModuleCount,
  userMatchesSide,
  validateCustomUserInput,
} from "./custom-users.ts";

const access = sanitizeCustomAccess({
  companies: ["stl", "sarvah", "shmp"],
  modules: {
    stl: ["inventory", "stores"],
    sarvah: ["inventory"],
    shmp: ["production", "orders"],
    shlaxmi: ["hr"],
  },
});

describe("custom user access", () => {
  it("keeps known modules for selected companies only", () => {
    assert.equal(access.ok, true);
    if (!access.ok) return;
    assert.deepEqual(access.access.companies, ["stl", "sarvah", "shmp"]);
    assert.deepEqual(access.access.modules.stl, ["inventory", "stores"]);
    assert.equal(access.access.modules.shlaxmi, undefined);
    assert.equal(sellingModuleVisible(access.access, "inventory"), true);
    assert.equal(sellingModuleVisible(access.access, "hr"), false);
  });

  it("requires a company and a module", () => {
    assert.equal(sanitizeCustomAccess({ companies: [], modules: {} }).ok, false);
    assert.equal(
      sanitizeCustomAccess({ companies: ["stl"], modules: { stl: [] } }).ok,
      false,
    );
    assert.equal(
      sanitizeCustomAccess({ companies: ["nope"], modules: {} }).ok,
      false,
    );
  });

  it("shows a module when any selected company has it on", () => {
    assert.equal(access.ok, true);
    if (!access.ok) return;
    assert.equal(canCustomUserAccessPath(access.access, "/admin/inventory/new"), true);
    assert.equal(canCustomUserAccessPath(access.access, "/admin/hr"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/admin/users"), false);
    assert.equal(customUserRestrictedPath("/admin/users"), true);
    assert.equal(customUserRestrictedPath("/shmp/users/new"), true);
    assert.equal(customUserRestrictedPath("/admin/tracking"), true);
    assert.equal(customUserRestrictedPath("/admin/inventory"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/admin/tracking"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/shmp/production/abc"), true);
    assert.equal(canCustomUserAccessPath(access.access, "/shmp/categories"), false);
    const withInventory = sanitizeCustomAccess({
      companies: ["shmp"],
      modules: { shmp: ["inventory"] },
    });
    assert.equal(withInventory.ok, true);
    if (!withInventory.ok) return;
    assert.equal(canCustomUserAccessPath(withInventory.access, "/shmp/categories"), true);
    assert.equal(canCustomUserAccessPath(withInventory.access, "/shmp/catalog"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/shmp/hr"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/shmp/users/new"), false);
    assert.equal(firstAllowedPath(access.access, "stl"), "/admin/stores");
    assert.equal(firstAllowedPath(access.access, "shmp"), "/shmp/production");
  });

  it("opens the environment that has modules", () => {
    assert.equal(access.ok, true);
    if (!access.ok) return;
    assert.deepEqual(environmentsForAccess(access.access), ["stl", "shmp"]);
    assert.equal(customHomePath(access.access, ["stl", "shmp"], null), "/select-environment");
    assert.equal(customHomePath(access.access, ["shmp"], null), "/shmp/production");
    const shmpOnly = sanitizeCustomAccess({
      companies: ["stl", "shmp"],
      modules: { stl: [], shmp: ["orders"] },
    });
    assert.equal(shmpOnly.ok, true);
    if (!shmpOnly.ok) return;
    assert.deepEqual(environmentsForAccess(shmpOnly.access), ["shmp"]);
    assert.deepEqual(apiModuleKeysForAccess(shmpOnly.access), ["__none__"]);
  });

  it("maps selling toggles onto API module keys", () => {
    assert.equal(access.ok, true);
    if (!access.ok) return;
    const keys = apiModuleKeysForAccess(access.access);
    assert.equal(keys.includes("inventory"), true);
    assert.equal(keys.includes("stores"), true);
    assert.equal(keys.includes("__none__"), false);
  });

  it("locks an invalid access cookie", () => {
    assert.equal(readCustomAccess(null), null);
    assert.deepEqual(readCustomAccess({ companies: [] }), {
      companies: [],
      modules: {},
    });
  });

  it("recognises the four companies and filters a module's data", () => {
    assert.equal(companyKeyFromRecord({ name: "SH Lakshmi" }), "shlaxmi");
    assert.equal(companyKeyFromRecord({ name: "STL" }), "stl");
    assert.equal(companyKeyFromRecord({ prefix: "SHMP" }), "shmp");
    assert.equal(access.ok, true);
    if (!access.ok) return;
    const visible = filterCompaniesForModule(
      [{ name: "STL" }, { name: "Sarvah" }, { name: "SHMP" }, { name: "Other" }],
      access.access,
      "stores",
    );
    assert.deepEqual(
      visible.map((company) => company.name),
      ["STL"],
    );
  });

  it("validates the create and edit payloads", () => {
    const created = validateCustomUserInput(
      {
        name: "Asha",
        email: "Asha@Example.com",
        password: "secret",
        companies: ["shlaxmi"],
        modules: { shlaxmi: ["hr", "not-a-module"] },
      },
      "create",
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.value.email, "asha@example.com");
    assert.deepEqual(created.value.access.modules.shlaxmi, ["hr"]);

    const fields = sanitizeCustomAccess({
      companies: ["stl", "shmp"],
      modules: {
        stl: ["dashboard", "dashboard:this-month", "dashboard:nope", "sales-profiles"],
        shmp: ["hr", "hr:salary", "hr:__none__"],
      },
    });
    assert.equal(fields.ok, true);
    if (!fields.ok) return;
    assert.deepEqual(fields.access.modules.stl, ["dashboard", "dashboard:this-month"]);
    assert.deepEqual(fields.access.modules.shmp, ["hr", "hr:salary", "hr:__none__"]);
    assert.deepEqual(moduleFields("stl", "hr").map((field) => field.id), [
      "salary",
      "passport",
      "eid",
      "visa",
      "insurance",
    ]);
    const droppedPermit = sanitizeCustomAccess({
      companies: ["stl"],
      modules: { stl: ["hr", "hr:salary", "hr:sharjah"] },
    });
    assert.equal(droppedPermit.ok, true);
    if (!droppedPermit.ok) return;
    assert.deepEqual(droppedPermit.access.modules.stl, ["hr", "hr:salary"]);
    const onlyPermit = sanitizeCustomAccess({
      companies: ["stl"],
      modules: { stl: ["hr", "hr:sharjah"] },
    });
    assert.equal(onlyPermit.ok, true);
    if (!onlyPermit.ok) return;
    assert.deepEqual(onlyPermit.access.modules.stl, ["hr", "hr:__none__"]);
    assert.equal(portalFieldVisible(fields.access, "selling", "dashboard", "this-month"), true);
    assert.equal(portalFieldVisible(fields.access, "selling", "dashboard", "visa"), false);
    assert.equal(portalFieldVisible(null, "selling", "dashboard", "visa"), true);
    assert.equal(userMatchesSide(["shmp"], "admin"), false);
    assert.equal(userMatchesSide(["stl", "shmp"], "admin"), true);
    assert.equal(userMatchesSide(["sarvah"], "admin"), true);
    assert.equal(userMatchesSide(["shmp"], "shmp"), true);
    assert.equal(sideModuleCount(fields.access, "admin"), 1);

    const missingPassword = validateCustomUserInput(
      {
        name: "Asha",
        email: "asha@example.com",
        companies: ["stl"],
        modules: { stl: ["stores"] },
      },
      "create",
    );
    assert.equal(missingPassword.ok, false);

    const updated = validateCustomUserInput(
      {
        name: "Asha",
        email: "asha@example.com",
        password: "",
        companies: ["stl"],
        modules: { stl: ["stores"] },
      },
      "update",
    );
    assert.equal(updated.ok, true);
  });

  it("lets only lav offer both portals", () => {
    assert.deepEqual(companiesOfferedToEditor("admin", "lav@shrseetal.com"), [
      "stl",
      "sarvah",
      "shlaxmi",
      "shmp",
    ]);
    assert.deepEqual(companiesOfferedToEditor("shmp", "Lav@shrseetal.com"), [
      "shmp",
      "stl",
      "sarvah",
      "shlaxmi",
    ]);
    assert.deepEqual(companiesOfferedToEditor("admin", "admin@gmail.com"), [
      "stl",
      "sarvah",
      "shlaxmi",
    ]);
    assert.deepEqual(companiesOfferedToEditor("shmp", "admin@gmail.com"), ["shmp"]);
  });

  it("limits Seetal drivers only after a grant is saved", () => {
    const open = sanitizeCustomAccess({
      companies: ["stl"],
      modules: { stl: ["drivers-vehicles"] },
    });
    assert.equal(open.ok, true);
    if (!open.ok) return;
    assert.equal(fleetActionOn(open.access, "selling", "delete"), true);
    assert.equal(fleetActionOn(null, "selling", "delete"), true);
    assert.deepEqual(sellingFleetForEditor(open.access).actions, {
      create: true,
      read: true,
      update: true,
      delete: true,
    });

    const limited = readCustomAccess({
      companies: ["stl"],
      modules: { stl: ["drivers-vehicles"] },
      explicit: true,
      permissions: {
        version: 1,
        shmp: {},
        selling: {
          actions: { create: false, read: true, update: false, delete: false },
          drivers: { mode: "selected", ids: ["d1"] },
          vehicles: { mode: "all" },
        },
      },
    });
    assert.ok(limited);
    if (!limited) return;
    assert.equal(fleetActionOn(limited, "selling", "read"), true);
    assert.equal(fleetActionOn(limited, "selling", "update"), false);
    assert.equal(fleetRecordOn(limited, "selling", "drivers", "d1"), true);
    assert.equal(fleetRecordOn(limited, "selling", "drivers", "d2"), false);
    assert.equal(sellingModuleVisible(limited, "drivers-vehicles"), true);
    assert.equal(canCustomUserAccessPath(limited, "/admin/drivers"), true);

    const hidden = readCustomAccess({
      companies: ["stl"],
      modules: { stl: ["drivers-vehicles"] },
      explicit: true,
      permissions: {
        version: 1,
        shmp: {},
        selling: {
          actions: { create: false, read: false, update: false, delete: false },
          drivers: { mode: "all" },
          vehicles: { mode: "all" },
        },
      },
    });
    assert.ok(hidden);
    if (!hidden) return;
    assert.equal(sellingModuleVisible(hidden, "drivers-vehicles"), false);
    assert.equal(canCustomUserAccessPath(hidden, "/admin/vehicles/abc"), false);
  });

  it("keeps the other side's grants when only one side is edited", () => {
    const fromSeetal = permissionsPayloadForSave({
      offered: ["stl", "sarvah", "shlaxmi"],
      companies: ["stl", "shmp"],
      modules: { stl: ["drivers-vehicles"], shmp: ["stores"] },
      shmpPermissions: { version: 1, shmp: {} },
      sellingFleet: newFleetGrant(),
      existing: null,
    });
    assert.equal(fromSeetal?.shmp.stores?.actions.delete, true);
    assert.equal(fromSeetal?.selling?.actions.read, true);
    assert.equal(fromSeetal?.selling?.actions.create, false);

    const fromShmp = permissionsPayloadForSave({
      offered: ["shmp"],
      companies: ["shmp"],
      modules: { shmp: ["stores"], stl: ["drivers-vehicles"] },
      shmpPermissions: {
        version: 1,
        shmp: {
          stores: {
            actions: { create: false, read: true, update: false, delete: false },
            fields: {},
            block: false,
            salesmen: { mode: "all" },
          },
        },
      },
      sellingFleet: newFleetGrant(),
      existing: {
        explicit: true,
        permissions: {
          version: 1,
          shmp: {},
          selling: {
            actions: { create: true, read: true, update: true, delete: false },
            drivers: { mode: "selected", ids: ["d1"] },
            vehicles: { mode: "all" },
          },
        },
      },
    });
    assert.equal(fromShmp?.shmp.stores?.actions.read, true);
    assert.equal(fromShmp?.selling?.actions.delete, false);
    assert.deepEqual(fromShmp?.selling?.drivers, { mode: "selected", ids: ["d1"] });
  });
});

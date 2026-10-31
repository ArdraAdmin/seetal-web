import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiModuleKeysForAccess,
  canCustomUserAccessPath,
  companyKeyFromRecord,
  customHomePath,
  environmentsForAccess,
  filterCompaniesForModule,
  firstAllowedPath,
  readCustomAccess,
  sanitizeCustomAccess,
  sellingModuleVisible,
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
    assert.equal(canCustomUserAccessPath(access.access, "/admin/tracking"), false);
    assert.equal(canCustomUserAccessPath(access.access, "/shmp/production/abc"), true);
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
});

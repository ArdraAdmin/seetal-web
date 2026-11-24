import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshCompanyDocumentGrant } from "./shmp-permissions.ts";
import { permissionsPayloadForSave, sellingModuleVisible } from "./custom-users.ts";
import {
  companyDocumentPowers,
  creatableCompanies,
  documentFileError,
  expiryDateError,
  expiryStatus,
  readableCompanies,
} from "./company-documents.ts";

describe("company document rules", () => {
  it("rejects files that are not company documents", () => {
    assert.equal(documentFileError({ name: "license.pdf", size: 10 }), null);
    assert.equal(documentFileError({ name: "sheet.xlsx", size: 10 }), null);
    assert.equal(
      documentFileError({ name: "notes.txt", size: 10 }),
      "Upload a PDF, JPEG, PNG, WebP, Word, or Excel file",
    );
    assert.equal(expiryDateError(false, ""), null);
    assert.equal(expiryDateError(true, ""), "Expiry date is required");
    assert.equal(expiryDateError(true, "2026-02-31"), "Expiry date is invalid");
    assert.deepEqual(expiryStatus(true, "2026-01-01", "2026-11-24"), {
      label: "Expired 2026-01-01",
      expired: true,
    });
  });

  it("limits Seetal companies and keeps read-only users from adding documents", () => {
    const access = {
      companies: ["stl", "sarvah"] as const,
      modules: { stl: ["my-company"], sarvah: ["my-company"] },
      explicit: true,
      permissions: {
        version: 1 as const,
        shmp: {},
        sellingMyCompany: {
          stl: freshCompanyDocumentGrant(),
          sarvah: {
            actions: { create: false, read: false, update: false, delete: false },
            documents: { mode: "all" as const },
          },
        },
      },
    };
    assert.deepEqual(readableCompanies(access, "selling"), ["stl"]);
    assert.deepEqual(creatableCompanies(access, "selling"), []);
    assert.equal(companyDocumentPowers(access, "selling", "stl").read, true);
    assert.equal(companyDocumentPowers(access, "selling", "stl").create, false);
    assert.equal(sellingModuleVisible(access, "my-company"), true);
    assert.deepEqual(readableCompanies(null, "shmp"), ["shmp"]);
  });

  it("saves selected document access with the user", () => {
    const grant = {
      actions: { create: false, read: true, update: false, delete: false },
      documents: { mode: "selected" as const, ids: ["doc-1"] },
    };
    const saved = permissionsPayloadForSave({
      offered: ["stl", "sarvah", "shlaxmi"],
      companies: ["stl"],
      modules: { stl: ["my-company"] },
      shmpPermissions: { version: 1, shmp: {} },
      sellingFleet: {
        actions: { create: false, read: true, update: false, delete: false },
        drivers: { mode: "all" },
        vehicles: { mode: "all" },
      },
      sellingMyCompany: { stl: grant },
      existing: null,
    });
    assert.deepEqual(saved?.sellingMyCompany?.stl, grant);
    assert.equal(saved?.selling, undefined);
  });
});

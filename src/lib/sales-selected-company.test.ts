import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessFromSelectedCompany,
  isSalesInventoryKey,
  resolveSalesCompanyByKey,
  sellingCatalogKey,
} from "./sales-selected-company.ts";

const companies = [
  { _id: "sarvah-id", name: "Sarvah", prefix: "SARVAH" },
  { _id: "shmp-id", name: "SHMP", prefix: "SHMP" },
  { _id: "stl-id", name: "STL", prefix: "STL" },
];

describe("sellingCatalogKey", () => {
  it("maps Sarvah to the SHMP-labeled catalog", () => {
    assert.equal(sellingCatalogKey("sarvah"), "shmp");
    assert.equal(sellingCatalogKey("shmp"), "shmp");
    assert.equal(sellingCatalogKey("stl"), "stl");
    assert.equal(sellingCatalogKey("shlaxmi"), null);
  });
});

describe("resolveSalesCompanyByKey", () => {
  it("resolves Sarvah to the SHMP company, not the Sarvah company", () => {
    assert.deepEqual(resolveSalesCompanyByKey("sarvah", companies), {
      id: "shmp-id",
      name: "sarvah",
    });
    assert.deepEqual(resolveSalesCompanyByKey("shmp", companies), {
      id: "shmp-id",
      name: "shmp",
    });
    assert.deepEqual(resolveSalesCompanyByKey("stl", companies), {
      id: "stl-id",
      name: "stl",
    });
  });

  it("does not fall back to a Sarvah company when SHMP is missing", () => {
    assert.equal(
      resolveSalesCompanyByKey("sarvah", [
        { _id: "sarvah-id", name: "Sarvah" },
        { _id: "stl-id", name: "STL" },
      ]),
      null,
    );
  });
});

describe("accessFromSelectedCompany", () => {
  it("lets Sarvah orders use SHMP-labeled products", () => {
    const access = accessFromSelectedCompany({
      id: "shmp-id",
      name: "sarvah",
    });
    assert.deepEqual(access.companyIds, ["shmp-id"]);
    assert.deepEqual(access.companyNames, ["SHMP"]);
    assert.equal(access.includeUnassigned, false);
  });

  it("keeps SHMP workspace on the same catalog company", () => {
    const access = accessFromSelectedCompany({
      id: "shmp-id",
      name: "shmp",
    });
    assert.deepEqual(access.companyIds, ["shmp-id"]);
    assert.deepEqual(access.companyNames, ["SHMP"]);
  });
});

describe("isSalesInventoryKey", () => {
  it("treats Sarvah as inventory so stores open the catalog directly", () => {
    assert.equal(isSalesInventoryKey("sarvah"), true);
    assert.equal(isSalesInventoryKey("stl"), true);
    assert.equal(isSalesInventoryKey("shmp"), true);
    assert.equal(isSalesInventoryKey("shlaxmi"), false);
  });
});

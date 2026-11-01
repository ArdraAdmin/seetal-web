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
  { _id: "lakshmi-id", name: "SH Lakshmi", prefix: "SHL" },
];

describe("sellingCatalogKey", () => {
  it("keeps each company on its own catalog", () => {
    assert.equal(sellingCatalogKey("sarvah"), "sarvah");
    assert.equal(sellingCatalogKey("shmp"), "shmp");
    assert.equal(sellingCatalogKey("stl"), "stl");
    assert.equal(sellingCatalogKey("shlaxmi"), "shlaxmi");
  });
});

describe("resolveSalesCompanyByKey", () => {
  it("resolves each card to that company", () => {
    assert.deepEqual(resolveSalesCompanyByKey("sarvah", companies), {
      id: "sarvah-id",
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
    assert.deepEqual(resolveSalesCompanyByKey("shlaxmi", companies), {
      id: "lakshmi-id",
      name: "shlaxmi",
    });
  });

  it("does not use SHMP when the Sarvah company is missing", () => {
    assert.equal(
      resolveSalesCompanyByKey("sarvah", [
        { _id: "shmp-id", name: "SHMP" },
        { _id: "stl-id", name: "STL" },
      ]),
      null,
    );
  });
});

describe("accessFromSelectedCompany", () => {
  it("lets Sarvah orders use Sarvah products", () => {
    const access = accessFromSelectedCompany({
      id: "sarvah-id",
      name: "sarvah",
    });
    assert.deepEqual(access.companyIds, ["sarvah-id"]);
    assert.deepEqual(access.companyNames, ["Sarvah"]);
    assert.equal(access.includeUnassigned, false);
  });

  it("keeps SHMP on its own catalog", () => {
    const access = accessFromSelectedCompany({
      id: "shmp-id",
      name: "shmp",
    });
    assert.deepEqual(access.companyIds, ["shmp-id"]);
    assert.deepEqual(access.companyNames, ["SHMP"]);
  });

  it("keeps SH Lakshmi on its own catalog", () => {
    const access = accessFromSelectedCompany({
      id: "lakshmi-id",
      name: "shlaxmi",
    });
    assert.deepEqual(access.companyIds, ["lakshmi-id"]);
    assert.deepEqual(access.companyNames, ["SH Laxmi", "SH Lakshmi"]);
  });
});

describe("isSalesInventoryKey", () => {
  it("treats every selling company as inventory", () => {
    assert.equal(isSalesInventoryKey("sarvah"), true);
    assert.equal(isSalesInventoryKey("stl"), true);
    assert.equal(isSalesInventoryKey("shmp"), true);
    assert.equal(isSalesInventoryKey("shlaxmi"), true);
  });
});

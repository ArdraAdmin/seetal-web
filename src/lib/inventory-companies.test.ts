import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeInventoryCompany,
  inventoryCompanyLabel,
  inventoryFieldsFromRecord,
  parseInventoryCompanyKey,
} from "./inventory-companies.ts";

describe("inventory company tabs", () => {
  it("names the three Seetal catalogues", () => {
    assert.equal(inventoryCompanyLabel("stl"), "STL");
    assert.equal(inventoryCompanyLabel("shlaxmi"), "SH Lakshmi");
    assert.equal(inventoryCompanyLabel("sarvah"), "Sarvah");
  });

  it("opens the requested company when that catalogue is allowed", () => {
    const allowed = ["stl", "shlaxmi", "sarvah"] as const;
    assert.equal(activeInventoryCompany("sarvah", allowed), "sarvah");
    assert.equal(activeInventoryCompany("shlaxmi", allowed), "shlaxmi");
    assert.equal(activeInventoryCompany("stl", allowed), "stl");
  });

  it("falls back to STL for a missing or unknown choice", () => {
    const allowed = ["stl", "shlaxmi", "sarvah"] as const;
    assert.equal(activeInventoryCompany(null, allowed), "stl");
    assert.equal(activeInventoryCompany("shmp", allowed), "stl");
    assert.equal(parseInventoryCompanyKey("Sarvah"), "sarvah");
    assert.equal(parseInventoryCompanyKey("seetal"), null);
  });

  it("does not open a company the account cannot use", () => {
    assert.equal(activeInventoryCompany("sarvah", ["stl", "shlaxmi"]), "stl");
    assert.equal(activeInventoryCompany("stl", ["sarvah"]), "sarvah");
    assert.equal(activeInventoryCompany("stl", []), null);
  });
});

describe("inventoryFieldsFromRecord", () => {
  it("keeps price, unit, and stock for the inventory row", () => {
    assert.deepEqual(
      inventoryFieldsFromRecord({
        unit: "PCS",
        ratio: 12,
        sellingPrice: 6,
        isDisplay: false,
        inQty: { amountInCartons: 1, amountInUnits: 4 },
      }),
      {
        unit: "PCS",
        ratio: 12,
        sellingPrice: 6,
        isDisplay: false,
        inQty: { amountInCartons: 1, amountInUnits: 4 },
      },
    );
  });

  it("ignores blank catalogue fields", () => {
    assert.deepEqual(inventoryFieldsFromRecord({ unit: "  ", ratio: "nope" }), {});
  });
});

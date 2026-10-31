import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pricingRowsFromProfiles,
  storePriceFieldValue,
  storeProfilesFromRows,
} from "./store-visibility.ts";

describe("store visibility", () => {
  it("keeps a selected store visible when the price is blank", () => {
    const result = storeProfilesFromRows([
      {
        key: "a",
        storeId: "store-1",
        storeName: "Deira",
        storePrice: "",
        storeItemCode: "",
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.profiles.length, 1);
    assert.equal(result.profiles[0].storeId, "store-1");
    assert.equal(result.profiles[0].storePrice, undefined);
    assert.equal(result.profiles[0].isDisplayed, true);
  });

  it("sends a store price only when one is entered", () => {
    const result = storeProfilesFromRows([
      {
        key: "a",
        storeId: "store-1",
        storeName: "Deira",
        storePrice: "40",
        storeItemCode: "D-1",
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.profiles[0].storePrice, 40);
    assert.equal(result.profiles[0].storeItemCode, "D-1");
  });

  it("rejects a negative store price", () => {
    const result = storeProfilesFromRows([
      {
        key: "a",
        storeId: "store-1",
        storeName: "Deira",
        storePrice: "-1",
        storeItemCode: "",
      },
    ]);
    assert.equal(result.ok, false);
  });

  it("rejects the same store selected twice", () => {
    const row = {
      key: "a",
      storeId: "store-1",
      storeName: "Deira",
      storePrice: "",
      storeItemCode: "",
    };
    const result = storeProfilesFromRows([row, { ...row, key: "b" }]);
    assert.equal(result.ok, false);
  });

  it("leaves the price blank when it matches the base selling price", () => {
    assert.equal(storePriceFieldValue(25, 25), "");
    assert.equal(storePriceFieldValue(undefined, 25), "");
    assert.equal(storePriceFieldValue(40, 25), "40");
  });

  it("loads only stores the product is visible in", () => {
    const rows = pricingRowsFromProfiles(
      [
        {
          store: { _id: "store-1", storeName: "Deira" },
          storePrice: 25,
          isDisplayed: true,
        },
        {
          store: { _id: "store-2", storeName: "Karama" },
          storePrice: 30,
          isDisplayed: false,
        },
      ],
      25,
    );
    assert.deepEqual(
      rows.map((row) => ({
        storeId: row.storeId,
        storeName: row.storeName,
        storePrice: row.storePrice,
      })),
      [{ storeId: "store-1", storeName: "Deira", storePrice: "" }],
    );
  });
});

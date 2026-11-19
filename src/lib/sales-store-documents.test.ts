import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  storeEidLabel,
  storeTradeLicenseDue,
  storesWithDueTradeLicenses,
  tradeLicenseAlertRows,
} from "./sales-store-documents.ts";

describe("sales store document helpers", () => {
  const now = new Date(Date.UTC(2026, 10, 17, 12));

  it("flags stores with trade licenses already expired or due within 15 days", () => {
    const stores = [
      { _id: "a", storeName: "Alpha", tradeLicenseExpiry: "2026-11-10" },
      { _id: "b", storeName: "Beta", tradeLicenseExpiry: "2026-11-25" },
      { _id: "c", storeName: "Gamma", tradeLicenseExpiry: "2027-01-01" },
      { _id: "d", storeName: "Delta" },
    ];
    assert.equal(storeTradeLicenseDue(stores[0], now), true);
    assert.equal(storeTradeLicenseDue(stores[1], now), true);
    assert.equal(storeTradeLicenseDue(stores[2], now), false);
    assert.equal(storeTradeLicenseDue(stores[3], now), false);
    assert.deepEqual(
      storesWithDueTradeLicenses(stores, now).map((store) => store._id),
      ["a", "b"],
    );
  });

  it("builds alert rows sorted by soonest expiry", () => {
    const rows = tradeLicenseAlertRows(
      [
        { _id: "later", storeName: "Later", tradeLicenseExpiry: "2026-11-30" },
        { _id: "sooner", storeName: "Sooner", tradeLicenseExpiry: "2026-11-18" },
      ],
      now,
    );
    assert.equal(rows[0]?.id, "sooner");
    assert.equal(rows[1]?.id, "later");
  });

  it("returns a blank EID label when the store has none", () => {
    assert.equal(storeEidLabel({ eidNumber: " 784-1 " }), "784-1");
    assert.equal(storeEidLabel({}), "");
  });
});

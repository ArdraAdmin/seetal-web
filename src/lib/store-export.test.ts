import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STORE_EXPORT_HEADERS, storeExportRow } from "./store-export.ts";
import { parseTradeLicenseExpiryDate, tradeLicenseDateInput } from "./store-documents.ts";

describe("store export", () => {
  it("includes every store field and a date without a time", () => {
    const row = storeExportRow(
      {
        storeName: "Al Noor",
        marks: "AN",
        alias: "Noor",
        contactNumber: "0500000000",
        addressLine1: "Shop 1",
        addressLine2: "Street",
        addressLine3: "",
        city: "Dubai",
        country: "United Arab Emirates",
        uid: "STL-1",
        trnNo: "100",
        tradeLicenseExpiry: "2026-12-01T18:30:00.000Z",
        trnDocumentUrl: "https://files.example/trn.pdf",
        tradeLicenseDocumentUrl: "https://files.example/license.pdf",
        eidNumber: "784-1990-1234567-1",
        eidDocumentFileName: "eid.pdf",
        orderBlocked: true,
        isTemp: false,
      },
      "Amina",
    );
    assert.deepEqual(Object.keys(row), [...STORE_EXPORT_HEADERS]);
    assert.equal(row["Store name"], "Al Noor");
    assert.equal(row["Store code"], "STL-1");
    assert.equal(row["EID number"], "784-1990-1234567-1");
    assert.equal(row["EID document"], "eid.pdf");
    assert.equal(row["Sales people"], "Amina");
    assert.equal(row.Orders, "Blocked");
    assert.equal(row.Temporary, "No");
    assert.match(row["Trade license expiry"], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(row["Trade license expiry"].includes("T"), false);
  });
});

describe("trade license date", () => {
  it("keeps a date-only value and stores it at noon UTC", () => {
    assert.equal(tradeLicenseDateInput("2026-12-01"), "2026-12-01");
    const stored = parseTradeLicenseExpiryDate("2026-12-01");
    assert.ok(stored);
    assert.equal(stored?.toISOString(), "2026-12-01T12:00:00.000Z");
    assert.equal(parseTradeLicenseExpiryDate("2026-02-31"), null);
    assert.equal(parseTradeLicenseExpiryDate(""), null);
  });
});

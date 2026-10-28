import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPackedCartonsValue,
  formatProductionLogDate,
  productionLogMatchesQuery,
  productionLogStoreName,
  type ShmpProductionLog,
} from "./shmp-production.ts";

const log: ShmpProductionLog = {
  worker: { name: "Ahmed" },
  company: { name: "SHMP" },
  order: { _id: "ord1", invoiceNo: "shmp/pratham/0006" },
  store: { storeName: "Al Ain Market", uid: "AA-01" },
  item: { name: "Floor tile", itemRef: "FT-12" },
  date: "2026-10-28T08:00:00.000Z",
  cartonQty: 8,
  value: 240,
};

describe("productionLogStoreName", () => {
  it("reads the packed store name", () => {
    assert.equal(productionLogStoreName(log), "Al Ain Market");
    assert.equal(productionLogStoreName({ store: null }), "");
  });
});

describe("productionLogMatchesQuery", () => {
  it("matches worker, invoice, item, or store", () => {
    assert.equal(productionLogMatchesQuery(log, ""), true);
    assert.equal(productionLogMatchesQuery(log, "ahmed"), true);
    assert.equal(productionLogMatchesQuery(log, "0006"), true);
    assert.equal(productionLogMatchesQuery(log, "floor"), true);
    assert.equal(productionLogMatchesQuery(log, "al ain"), true);
    assert.equal(productionLogMatchesQuery(log, "aa-01"), true);
    assert.equal(productionLogMatchesQuery(log, "28 oct"), true);
    assert.equal(productionLogMatchesQuery(log, "missing"), false);
  });
});

describe("formatProductionLogDate", () => {
  it("formats a packed date", () => {
    assert.equal(
      formatProductionLogDate("2026-10-28T08:00:00.000Z"),
      "28 Oct 2026",
    );
    assert.equal(formatProductionLogDate(""), "");
    assert.equal(formatProductionLogDate("not-a-date"), "");
  });
});

describe("formatPackedCartonsValue", () => {
  it("formats AED values", () => {
    assert.equal(formatPackedCartonsValue(240), "AED 240.00");
    assert.equal(formatPackedCartonsValue(Number.NaN), "AED 0.00");
  });
});

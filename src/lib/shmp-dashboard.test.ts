import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceFilterHref,
  hrFilterHref,
  parseHrDayFilter,
  shmpSalesCategoryRows,
  shmpSalesTotal,
  shmpStockSnapshot,
} from "./shmp-dashboard.ts";

describe("parseHrDayFilter", () => {
  it("accepts known HR day filters", () => {
    assert.equal(parseHrDayFilter("present"), "present");
    assert.equal(parseHrDayFilter("absent"), "absent");
    assert.equal(parseHrDayFilter("leave"), "leave");
    assert.equal(parseHrDayFilter("total"), "total");
  });

  it("rejects unknown or empty values", () => {
    assert.equal(parseHrDayFilter("holiday"), null);
    assert.equal(parseHrDayFilter(""), null);
    assert.equal(parseHrDayFilter(null), null);
    assert.equal(parseHrDayFilter(undefined), null);
  });
});

describe("attendanceFilterHref", () => {
  it("builds the attendance roster deep link", () => {
    assert.equal(attendanceFilterHref("present"), "/shmp/attendance?filter=present");
    assert.equal(attendanceFilterHref("leave"), "/shmp/attendance?filter=leave");
    assert.equal(hrFilterHref("absent"), "/shmp/attendance?filter=absent");
  });
});

describe("shmpSalesCategoryRows", () => {
  const sarvahRows = [
    { categoryName: "Tiles — Floor", value: 1200 },
    { categoryName: "Sanitaryware", value: 800 },
  ];

  it("returns no sales when SHMP has not added its own inventory", () => {
    assert.deepEqual(shmpSalesCategoryRows(sarvahRows, false), []);
    assert.equal(shmpSalesTotal(shmpSalesCategoryRows(sarvahRows, false)), 0);
  });

  it("groups confirmed SHMP production sales by master category", () => {
    const rows = shmpSalesCategoryRows(
      [
        { categoryName: "Tiles — Floor", value: 1200 },
        { categoryName: "Tiles — Wall", value: 300 },
        { categoryName: "Sanitaryware — Basins", value: 800 },
        { categoryName: "Ignored", value: 0 },
      ],
      true,
    );
    assert.deepEqual(rows, [
      { key: "Tiles", label: "Tiles", value: 1500 },
      { key: "Sanitaryware", label: "Sanitaryware", value: 800 },
    ]);
    assert.equal(shmpSalesTotal(rows), 2300);
  });

  it("does not fall back to empty or missing category rows", () => {
    assert.deepEqual(shmpSalesCategoryRows(undefined, true), []);
    assert.deepEqual(shmpSalesCategoryRows([], true), []);
  });
});

describe("shmpStockSnapshot", () => {
  it("returns an empty snapshot for no products", () => {
    assert.deepEqual(shmpStockSnapshot([]), { skus: 0, value: 0 });
  });

  it("values own stock as price times cartons and loose units", () => {
    assert.deepEqual(
      shmpStockSnapshot([
        {
          sellingPrice: 12.5,
          ratio: 4,
          inQty: { amountInCartons: 2, amountInUnits: 3 },
        },
        {
          sellingPrice: 8,
          ratio: 0,
          inQty: { amountInCartons: 1, amountInUnits: 0 },
        },
      ]),
      { skus: 2, value: 12.5 * (2 * 4 + 3) + 8 },
    );
  });
});

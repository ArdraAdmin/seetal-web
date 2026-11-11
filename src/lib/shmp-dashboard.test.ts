import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceFilterHref,
  categorySliceTotal,
  hrFilterHref,
  inventoryCategoryLabel,
  parseHrDayFilter,
  shmpInventoryCategoryRows,
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

describe("shmpInventoryCategoryRows", () => {
  it("groups on-hand SHMP stock by master category and skips empty stock", () => {
    const rows = shmpInventoryCategoryRows([
      {
        sellingPrice: 10,
        ratio: 2,
        inQty: { amountInCartons: 3, amountInUnits: 0 },
        category: { masterCategoryName: "Tiles — Floor" },
      },
      {
        sellingPrice: 5,
        ratio: 1,
        inQty: { amountInCartons: 4, amountInUnits: 0 },
        category: { masterCategory: "Tiles" },
      },
      {
        sellingPrice: 8,
        ratio: 1,
        inQty: { amountInCartons: 2, amountInUnits: 0 },
        category: { subCategory: "Basins" },
      },
      {
        sellingPrice: 20,
        ratio: 1,
        inQty: { amountInCartons: 0, amountInUnits: 0 },
        categoryName: "Ignored",
      },
    ]);
    assert.deepEqual(rows, [
      { key: "Tiles", label: "Tiles", value: 80 },
      { key: "Basins", label: "Basins", value: 16 },
    ]);
    assert.equal(categorySliceTotal(rows), 96);
    assert.equal(inventoryCategoryLabel({}), "Uncategorised");
  });

  it("returns no rows when there is no stock", () => {
    assert.deepEqual(shmpInventoryCategoryRows([]), []);
    assert.equal(categorySliceTotal([]), 0);
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

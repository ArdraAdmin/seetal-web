import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateCategoryParents } from "./category-sales-pie.ts";

describe("aggregateCategoryParents", () => {
  it("rolls subcategories into parent slices and sorts by revenue", () => {
    const slices = aggregateCategoryParents([
      {
        categoryId: "1",
        name: "Gifting, Party, Festive / Festive Items",
        revenue: 100,
      },
      {
        categoryId: "2",
        name: "Gifting, Party, Festive / Candles",
        revenue: 50,
      },
      {
        categoryId: "3",
        name: "Educational Items / Books",
        revenue: 80,
      },
      { categoryId: null, name: "Uncategorized", revenue: 20 },
    ]);

    assert.equal(slices.length, 3);
    assert.equal(slices[0].name, "Gifting, Party, Festive");
    assert.equal(slices[0].revenue, 150);
    assert.equal(slices[1].name, "Educational Items");
    assert.equal(slices[1].revenue, 80);
    assert.equal(slices[2].name, "Uncategorized");
    assert.equal(Math.round(slices[0].pct), 60);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftCartonTotal,
  formatRmQty,
  packagingSummary,
  usageShortage,
} from "./rm-usage.ts";

describe("packaging usage", () => {
  it("totals cartons and labels separately", () => {
    assert.deepEqual(
      packagingSummary([
        { kind: "Carton", quantity: 10 },
        { kind: "Label", quantity: 480 },
        { kind: "Other", quantity: 5 },
      ]),
      { cartons: 10, labels: 480 },
    );
  });

  it("reports how much a line is short", () => {
    assert.equal(usageShortage({ quantity: 96, balance: 50 }), 46);
    assert.equal(usageShortage({ quantity: 10, balance: 40 }), 0);
    assert.equal(usageShortage({ quantity: 10, balance: null }), 0);
  });

  it("sums only the carton quantities entered so far", () => {
    assert.equal(
      draftCartonTotal([
        { cartonQty: "6" },
        { cartonQty: "" },
        { cartonQty: "4" },
        { cartonQty: "0" },
      ]),
      10,
    );
  });

  it("formats quantities without trailing zeros", () => {
    assert.equal(formatRmQty(480), "480");
    assert.equal(formatRmQty(1.5), "1.5");
  });
});

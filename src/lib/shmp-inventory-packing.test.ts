import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  derivePiecesPerCarton,
  normalizeShmpUnit,
  packingRatiosFromProduct,
  parseRequiredPackingCount,
} from "./shmp-inventory-packing.ts";

describe("normalizeShmpUnit", () => {
  it("maps legacy PCS/SET values onto the new dropdown", () => {
    assert.equal(normalizeShmpUnit("PCS"), "Pcs");
    assert.equal(normalizeShmpUnit("sets"), "Sets");
    assert.equal(normalizeShmpUnit("BOX"), "Box");
    assert.equal(normalizeShmpUnit("Pcs"), "Pcs");
  });
});

describe("derivePiecesPerCarton", () => {
  it("uses Pcs/Ctn directly", () => {
    assert.equal(derivePiecesPerCarton("Pcs", 1, "Pcs/Ctn", 48), 48);
  });

  it("multiplies pieces per set by sets per carton", () => {
    assert.equal(derivePiecesPerCarton("Pcs/Set", 12, "Sets/Ctn", 10), 120);
  });
});

describe("packingRatiosFromProduct migration A", () => {
  it("maps legacy ratio to Pcs + 1 and Pcs/Ctn + ratio", () => {
    assert.deepEqual(packingRatiosFromProduct({ ratio: 36 }), {
      unitRatioKind: "Pcs",
      unitRatioValue: "1",
      cartonRatioKind: "Pcs/Ctn",
      cartonRatioValue: "36",
    });
  });

  it("keeps structured ratio fields when present", () => {
    assert.deepEqual(
      packingRatiosFromProduct({
        unitRatioKind: "Pcs/Set",
        unitRatioValue: 6,
        cartonRatioKind: "Sets/Ctn",
        cartonRatioValue: 8,
        ratio: 48,
      }),
      {
        unitRatioKind: "Pcs/Set",
        unitRatioValue: "6",
        cartonRatioKind: "Sets/Ctn",
        cartonRatioValue: "8",
      },
    );
  });
});

describe("parseRequiredPackingCount", () => {
  it("requires a non-negative number with no default", () => {
    assert.equal(parseRequiredPackingCount("", "Labels").ok, false);
    assert.deepEqual(parseRequiredPackingCount("0", "Labels"), {
      ok: true,
      value: 0,
    });
    assert.deepEqual(parseRequiredPackingCount("4", "Labels"), {
      ok: true,
      value: 4,
    });
  });
});

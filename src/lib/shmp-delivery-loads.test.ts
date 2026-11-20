import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocatedQtyForProduct,
  emptyDeliveryLoad,
  loadCartonTotal,
  maxQtyInputForLoad,
  remainingQtyForProduct,
  setLoadProductQty,
  unassignedCartons,
  validateAndBuildDeliveryLoads,
  type DeliveryLoadDraft,
} from "./shmp-delivery-loads.ts";

const lines = [
  { productId: "p1", qty: 1000, name: "Hanger" },
  { productId: "p2", qty: 40, name: "Clip" },
];

function load(
  partial: Partial<DeliveryLoadDraft> & { key: string },
): DeliveryLoadDraft {
  return {
    vehicleId: "",
    qtys: {},
    ...partial,
  };
}

describe("allocatedQtyForProduct", () => {
  it("sums qtys across loads and can skip one", () => {
    const loads = [
      load({ key: "a", qtys: { p1: "250" } }),
      load({ key: "b", qtys: { p1: "100", p2: "10" } }),
    ];
    assert.equal(allocatedQtyForProduct(loads, "p1"), 350);
    assert.equal(allocatedQtyForProduct(loads, "p1", "a"), 100);
    assert.equal(allocatedQtyForProduct(loads, "p2"), 10);
  });
});

describe("remaining and max input", () => {
  it("leaves leftover cartons unassigned", () => {
    const loads = [load({ key: "a", qtys: { p1: "250" } })];
    assert.equal(remainingQtyForProduct(1000, loads, "p1"), 750);
    assert.equal(maxQtyInputForLoad(1000, loads, "p1", "a"), 1000);
    assert.equal(maxQtyInputForLoad(1000, loads, "p1", "b"), 750);
    assert.equal(unassignedCartons(lines, loads), 750 + 40);
  });
});

describe("emptyDeliveryLoad", () => {
  it("starts with blank vehicle and qty fields", () => {
    const draft = emptyDeliveryLoad(["p1", "p2"]);
    assert.equal(draft.vehicleId, "");
    assert.equal(draft.qtys.p1, "");
    assert.equal(draft.qtys.p2, "");
    assert.ok(draft.key);
  });
});

describe("loadCartonTotal", () => {
  it("totals positive carton inputs", () => {
    assert.equal(
      loadCartonTotal(load({ key: "a", qtys: { p1: "250", p2: "", p3: "10" } })),
      260,
    );
  });
});

describe("setLoadProductQty", () => {
  it("caps a later vehicle to the remaining balance", () => {
    const loads = [
      load({ key: "a", vehicleId: "v1", qtys: { p1: "1" } }),
      load({ key: "b", vehicleId: "v1", qtys: { p1: "" } }),
    ];
    const next = setLoadProductQty(loads, "b", "p1", "5", 2);
    assert.equal(next[0].qtys.p1, "1");
    assert.equal(next[1].qtys.p1, "1");
    assert.equal(maxQtyInputForLoad(2, next, "p1", "b"), 1);
    assert.equal(unassignedCartons([{ productId: "p1", qty: 2, name: "H" }], next), 0);
  });

  it("trims later vehicles when an earlier one takes more", () => {
    const loads = [
      load({ key: "a", vehicleId: "v1", qtys: { p1: "1" } }),
      load({ key: "b", vehicleId: "v1", qtys: { p1: "1" } }),
    ];
    const next = setLoadProductQty(loads, "a", "p1", "2", 2);
    assert.equal(next[0].qtys.p1, "2");
    assert.equal(next[1].qtys.p1, "0");
  });
});

describe("validateAndBuildDeliveryLoads", () => {
  it("builds one payload per load with cartons", () => {
    const loads = [
      load({
        key: "a",
        vehicleId: "v1",
        qtys: { p1: "250", p2: "10" },
      }),
      load({
        key: "b",
        vehicleId: "v1",
        qtys: { p1: "250" },
      }),
      load({ key: "c", vehicleId: "", qtys: { p1: "" } }),
    ];
    const result = validateAndBuildDeliveryLoads(lines, loads);
    assert.equal(result.error, null);
    assert.equal(result.payloads.length, 2);
    assert.deepEqual(result.payloads[0].lines, [
      { productId: "p1", qty: 250 },
      { productId: "p2", qty: 10 },
    ]);
    assert.equal(result.payloads[1].vehicleId, "v1");
  });

  it("rejects over-allocation and missing vehicle", () => {
    assert.match(
      validateAndBuildDeliveryLoads(lines, [
        load({ key: "a", vehicleId: "v1", qtys: { p1: "1001" } }),
      ]).error || "",
      /exceed/i,
    );
    assert.match(
      validateAndBuildDeliveryLoads(lines, [
        load({ key: "a", vehicleId: "", qtys: { p1: "10" } }),
      ]).error || "",
      /vehicle/i,
    );
    assert.match(
      validateAndBuildDeliveryLoads(lines, [
        load({ key: "a", vehicleId: "v1", qtys: { p1: "" } }),
      ]).error || "",
      /at least one carton/i,
    );
  });

  it("rejects fractional cartons", () => {
    assert.match(
      validateAndBuildDeliveryLoads(lines, [
        load({ key: "a", vehicleId: "v1", qtys: { p1: "1.5" } }),
      ]).error || "",
      /whole/i,
    );
  });
});

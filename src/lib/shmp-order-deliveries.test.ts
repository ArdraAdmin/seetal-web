import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deliveryLineName,
  deliveryTripCartons,
  deliveryVehicleLabel,
  deliveryVehicleSummary,
  tripsForOrder,
} from "./shmp-order-deliveries.ts";

describe("deliveryVehicleLabel", () => {
  it("prefers populated vehicle value, then vehicleNumber", () => {
    assert.equal(deliveryVehicleLabel({ vehicle: { value: 52014 } }), "#52014");
    assert.equal(deliveryVehicleLabel({ vehicleNumber: 99 }), "#99");
    assert.equal(
      deliveryVehicleLabel({ remarks: "Vehicle #12" }),
      "#12",
    );
    assert.equal(deliveryVehicleLabel({}), "Vehicle not recorded");
  });
});

describe("deliveryTripCartons", () => {
  it("sums line quantities", () => {
    assert.equal(
      deliveryTripCartons({
        lines: [{ qty: 1 }, { qty: 2 }, { qty: 0 }],
      }),
      3,
    );
  });
});

describe("deliveryLineName", () => {
  it("reads product name when populated", () => {
    assert.equal(
      deliveryLineName({ product: { itemName: "Hanger", itemRef: "1" } }),
      "Hanger",
    );
    assert.equal(deliveryLineName({ product: "abc" }), "Item");
  });
});

describe("deliveryVehicleSummary", () => {
  it("lists unique vehicles in trip order", () => {
    assert.deepEqual(
      deliveryVehicleSummary([
        { vehicle: { value: 1 }, lines: [{ qty: 1 }] },
        { vehicle: { value: 2 }, lines: [{ qty: 1 }] },
        { vehicleNumber: 1, lines: [{ qty: 1 }] },
      ]),
      ["#1", "#2"],
    );
  });
});

describe("tripsForOrder", () => {
  it("drops trips that belong to another order", () => {
    const trips = [
      { _id: "d1", tempOrder: { _id: "ord-a" }, vehicleNumber: 1 },
      { _id: "d2", tempOrder: "ord-a", vehicleNumber: 2 },
      { _id: "d3", tempOrder: { _id: "ord-b" }, vehicleNumber: 3 },
      { _id: "d4", vehicleNumber: 4 },
    ];
    assert.deepEqual(
      tripsForOrder(trips, "ord-a").map((trip) => trip._id),
      ["d1", "d2"],
    );
  });
});

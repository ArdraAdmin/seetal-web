import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ordersFromWarehousePayload } from "./warehouse.ts";

describe("ordersFromWarehousePayload", () => {
  it("returns a raw array of orders", () => {
    const orders = [{ _id: "a" }, { _id: "b" }];
    assert.deepEqual(ordersFromWarehousePayload(orders), orders);
  });

  it("reads orderArr from the pending warehouse response", () => {
    const orders = [{ _id: "today-1" }];
    assert.deepEqual(
      ordersFromWarehousePayload({
        orderArr: orders,
        pendingCheckCount: 1,
        unloadedCount: 0,
        totalPkgCount: 4,
      }),
      orders,
    );
  });

  it("returns an empty list for missing or invalid payloads", () => {
    assert.deepEqual(ordersFromWarehousePayload(null), []);
    assert.deepEqual(ordersFromWarehousePayload(undefined), []);
    assert.deepEqual(ordersFromWarehousePayload({ unloadedCount: 2 }), []);
    assert.deepEqual(ordersFromWarehousePayload("ReferenceError"), []);
  });
});

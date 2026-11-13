import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeDeliveryDateInput,
  ordersFromWarehousePayload,
  pendingSkipsSunday,
  warehousePendingRange,
  warehouseWorkDayRange,
} from "./warehouse.ts";

/** Saturday 7 Nov 2026, 14:00 Dubai. */
const SATURDAY = Date.UTC(2026, 10, 7, 10, 0, 0);
/** The placed order STL/Kamlesh/0264, stored as UTC midnight on 8 Nov. */
const SUNDAY_ORDER = Date.parse("2026-11-08T00:00:00.000Z");

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

describe("warehousePendingRange", () => {
  it("keeps Sunday orders on Pending when Saturday skips Sunday", () => {
    assert.equal(pendingSkipsSunday(SATURDAY, false), true);
    const work = warehouseWorkDayRange(SATURDAY, false);
    const pending = warehousePendingRange(SATURDAY, false);
    assert.ok(SUNDAY_ORDER < work.start.getTime());
    assert.ok(SUNDAY_ORDER >= pending.start.getTime());
    assert.ok(SUNDAY_ORDER <= pending.end.getTime());
    assert.equal(pending.end.getTime(), work.end.getTime());
  });

  it("does not widen Pending when Sunday delivery is on", () => {
    const work = warehouseWorkDayRange(SATURDAY, true);
    const pending = warehousePendingRange(SATURDAY, true);
    assert.equal(pendingSkipsSunday(SATURDAY, true), false);
    assert.equal(pending.start.getTime(), work.start.getTime());
    assert.equal(pending.end.getTime(), work.end.getTime());
    assert.ok(SUNDAY_ORDER >= pending.start.getTime());
    assert.ok(SUNDAY_ORDER <= pending.end.getTime());
  });

  it("leaves a normal weekday window unchanged", () => {
    const friday = Date.UTC(2026, 10, 6, 10, 0, 0);
    assert.equal(pendingSkipsSunday(friday, false), false);
    const work = warehouseWorkDayRange(friday, false);
    const pending = warehousePendingRange(friday, false);
    assert.equal(pending.start.getTime(), work.start.getTime());
    assert.equal(pending.end.getTime(), work.end.getTime());
  });
});

describe("normalizeDeliveryDateInput", () => {
  it("shifts Sunday to Monday when Sunday delivery is off", () => {
    const result = normalizeDeliveryDateInput("2026-11-08", false);
    assert.equal(result.shiftedFromSunday, true);
    assert.equal(result.date, "2026-11-09");
  });

  it("keeps Sunday when Sunday delivery is on", () => {
    const result = normalizeDeliveryDateInput("2026-11-08", true);
    assert.equal(result.shiftedFromSunday, false);
    assert.equal(result.date, "2026-11-08");
  });

  it("leaves Monday unchanged when Sunday delivery is off", () => {
    const result = normalizeDeliveryDateInput("2026-11-09", false);
    assert.equal(result.shiftedFromSunday, false);
    assert.equal(result.date, "2026-11-09");
  });
});

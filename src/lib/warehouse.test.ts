import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asDeliveredWarehouseOrder,
  normalizeDeliveryDateInput,
  ordersFromWarehousePayload,
  parseWarehouseListTab,
  pendingSkipsSunday,
  warehouseDeliveredDetailHref,
  warehouseDeliveredListHref,
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

describe("asDeliveredWarehouseOrder", () => {
  it("reads the nested order from the confirmed product response", () => {
    const order = {
      _id: "ord-1",
      invoiceNumber: "INV-9",
      productDetails: [{ quantityAv: 2 }],
    };
    assert.deepEqual(asDeliveredWarehouseOrder({ order }), order);
  });

  it("accepts a bare order document", () => {
    const order = { _id: "ord-2", productDetails: [] };
    assert.deepEqual(asDeliveredWarehouseOrder(order), order);
  });

  it("rejects missing or invalid payloads", () => {
    assert.equal(asDeliveredWarehouseOrder(null), null);
    assert.equal(asDeliveredWarehouseOrder({}), null);
    assert.equal(asDeliveredWarehouseOrder({ order: { invoiceNumber: "x" } }), null);
    assert.equal(asDeliveredWarehouseOrder({ order: [] }), null);
  });
});

describe("warehouseDeliveredDetailHref", () => {
  it("builds a delivered detail path under warehouse or admin", () => {
    assert.equal(
      warehouseDeliveredDetailHref("/warehouse", "abc123"),
      "/warehouse/delivered/abc123",
    );
    assert.equal(
      warehouseDeliveredDetailHref("/admin/warehouse/", "id with spaces"),
      "/admin/warehouse/delivered/id%20with%20spaces",
    );
  });

  it("returns empty when the order id is missing", () => {
    assert.equal(warehouseDeliveredDetailHref("/warehouse", ""), "");
    assert.equal(warehouseDeliveredDetailHref("/warehouse", "  "), "");
  });
});

describe("parseWarehouseListTab", () => {
  it("maps tab query values used by the warehouse list", () => {
    assert.equal(parseWarehouseListTab("2"), 2);
    assert.equal(parseWarehouseListTab("1"), 1);
    assert.equal(parseWarehouseListTab("4"), 4);
    assert.equal(parseWarehouseListTab(null), 0);
    assert.equal(parseWarehouseListTab("9"), 0);
  });

  it("builds the delivered list back link", () => {
    assert.equal(warehouseDeliveredListHref("/warehouse"), "/warehouse?tab=2");
    assert.equal(
      warehouseDeliveredListHref("/admin/warehouse/"),
      "/admin/warehouse?tab=2",
    );
  });
});

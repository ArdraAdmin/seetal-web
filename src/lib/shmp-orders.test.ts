import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cartonProgressLabel,
  dispatchFromLines,
  orderMatchesQuery,
  orderSection,
  orderStoreName,
  orderStoreUid,
  readyDeliveryLines,
} from "./shmp-orders.ts";

const order = {
  _id: "ord1",
  tempOrderInvoiceNo: "shmp/pratham/0006",
  status: "InProduction",
  store: { storeName: "Al Ain Market", uid: "AA-01" },
};

describe("orderStoreName", () => {
  it("reads the populated store name", () => {
    assert.equal(orderStoreName(order.store), "Al Ain Market");
    assert.equal(orderStoreName("6ae0b711b995698f546c2e93"), "");
    assert.equal(orderStoreName(null), "");
  });
});

describe("orderStoreUid", () => {
  it("reads the store uid when populated", () => {
    assert.equal(orderStoreUid(order.store), "AA-01");
    assert.equal(orderStoreUid(null), "");
  });
});

describe("orderSection", () => {
  it("keeps a new order pending until cartons are packed", () => {
    assert.equal(
      orderSection({
        dispatch: { ordered: 100, produced: 0, delivered: 0, ready: 0 },
      }),
      "pending",
    );
  });

  it("is ready while packed cartons have not been delivered", () => {
    assert.equal(
      orderSection({
        status: "InProduction",
        dispatch: { ordered: 100, produced: 40, delivered: 0, ready: 40 },
      }),
      "ready",
    );
  });

  it("returns to pending after those packed cartons are delivered", () => {
    assert.equal(
      orderSection({
        dispatch: { ordered: 100, produced: 40, delivered: 40, ready: 0 },
      }),
      "pending",
    );
  });

  it("is delivered when every ordered carton has gone out", () => {
    assert.equal(
      orderSection({
        dispatch: { section: "delivered", ordered: 100, delivered: 100, ready: 0 },
      }),
      "delivered",
    );
  });
});

describe("readyDeliveryLines", () => {
  it("sends every packed carton that is still waiting", () => {
    assert.deepEqual(
      readyDeliveryLines([
        { product: { _id: "p1", itemName: "Mug" }, ready: 20 },
        { product: { _id: "p2", itemName: "Jar" }, ready: 0 },
      ]),
      [{ productId: "p1", qty: 20, name: "Mug" }],
    );
  });
});

describe("dispatchFromLines", () => {
  it("builds the order totals from item quantities", () => {
    assert.deepEqual(
      dispatchFromLines([{ ordered: 100, produced: 50, delivered: 20 }]),
      {
        ordered: 100,
        produced: 50,
        delivered: 20,
        ready: 30,
        section: "ready",
      },
    );
    assert.equal(
      cartonProgressLabel({
        ordered: 100,
        produced: 50,
        ready: 30,
        delivered: 20,
      }),
      "50 packed · 30 ready · 20 delivered of 100",
    );
  });
});

describe("orderMatchesQuery", () => {
  it("matches invoice path or store name", () => {
    assert.equal(orderMatchesQuery(order, ""), true);
    assert.equal(orderMatchesQuery(order, "0006"), true);
    assert.equal(orderMatchesQuery(order, "al ain"), true);
    assert.equal(orderMatchesQuery(order, "aa-01"), true);
    assert.equal(orderMatchesQuery(order, "missing"), false);
  });
});

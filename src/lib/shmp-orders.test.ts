import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  orderMatchesQuery,
  orderStoreName,
  orderStoreUid,
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

describe("orderMatchesQuery", () => {
  it("matches invoice path or store name", () => {
    assert.equal(orderMatchesQuery(order, ""), true);
    assert.equal(orderMatchesQuery(order, "0006"), true);
    assert.equal(orderMatchesQuery(order, "al ain"), true);
    assert.equal(orderMatchesQuery(order, "aa-01"), true);
    assert.equal(orderMatchesQuery(order, "missing"), false);
  });
});

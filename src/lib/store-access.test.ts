import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ObjectId } from "mongodb";
import {
  BLOCKED_STORE_MESSAGE,
  personId,
  salesPersonIdsFromStore,
  storeAssignedToSalesman,
  storeOrderBlocked,
  storesVisibleToSalesperson,
} from "./store-access.ts";

describe("salesPersonIdsFromStore", () => {
  it("keeps a single saved sales person", () => {
    assert.deepEqual(
      salesPersonIdsFromStore({ salesPerson: "sales-a" }),
      ["sales-a"],
    );
  });

  it("includes every checked sales person and the primary id once", () => {
    assert.deepEqual(
      salesPersonIdsFromStore({
        salesPersons: ["sales-a", { _id: "sales-b" }, "sales-a"],
        salesPerson: "sales-a",
      }),
      ["sales-a", "sales-b"],
    );
  });

  it("falls back to the legacy salesman field", () => {
    assert.deepEqual(
      salesPersonIdsFromStore({ salesman: { _id: "sales-c", name: "C" } }),
      ["sales-c"],
    );
  });

  it("reads Mongo ObjectId assignments saved on the store", () => {
    const id = new ObjectId();
    const hex = id.toHexString();
    assert.equal(personId(id), hex);
    assert.equal(personId({ _id: id, name: "Sales" }), hex);
    assert.equal(personId({ $oid: hex.toUpperCase() }), hex);
    assert.deepEqual(
      salesPersonIdsFromStore({
        salesPerson: id,
        salesPersons: [id, { _id: id }],
      }),
      [hex],
    );
    assert.equal(storeAssignedToSalesman({ salesPersons: [id] }, hex), true);
    assert.equal(
      storeAssignedToSalesman({ salesPerson: id }, hex.toUpperCase()),
      true,
    );
  });
});

describe("storeAssignedToSalesman", () => {
  const store = {
    salesPerson: "sales-a",
    salesPersons: ["sales-a", "sales-b"],
  };

  it("allows each checked sales person", () => {
    assert.equal(storeAssignedToSalesman(store, "sales-a"), true);
    assert.equal(storeAssignedToSalesman(store, "sales-b"), true);
  });

  it("hides the store from everyone else", () => {
    assert.equal(storeAssignedToSalesman(store, "sales-c"), false);
    assert.equal(storeAssignedToSalesman(store, ""), false);
  });
});

describe("storeOrderBlocked", () => {
  it("is blocked only when the flag is on", () => {
    assert.equal(storeOrderBlocked({ orderBlocked: true }), true);
    assert.equal(storeOrderBlocked({ orderBlocked: "true" }), true);
    assert.equal(storeOrderBlocked({ orderBlocked: false }), false);
    assert.equal(storeOrderBlocked({}), false);
  });
});

describe("storesVisibleToSalesperson", () => {
  it("returns only stores assigned to that sales person", () => {
    const stores = [
      { _id: "1", salesPerson: "sales-a" },
      { _id: "2", salesPersons: ["sales-b"] },
      { _id: "3", salesPerson: "sales-c", orderBlocked: true },
    ];
    assert.deepEqual(
      storesVisibleToSalesperson(stores, "sales-b").map((store) => store._id),
      ["2"],
    );
    assert.equal(BLOCKED_STORE_MESSAGE.includes("blocked"), true);
  });
});

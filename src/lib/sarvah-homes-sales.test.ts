import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSarvahHomesStoreName,
  mergeSarvahAndAssignedShmpProducts,
  shouldMergeSarvahHomesInventory,
  withSarvahHomesShmpStores,
} from "./sarvah-homes-sales.ts";
import type { Product, StoreProfile } from "./types.ts";

describe("sarvah homes sales helpers", () => {
  it("recognises Sarvah Homes store name variants", () => {
    assert.equal(isSarvahHomesStoreName("SARVAH HOMES L L C"), true);
    assert.equal(isSarvahHomesStoreName("Sarvah Homes"), true);
    assert.equal(isSarvahHomesStoreName("ALFARAH GENERAL TRADING LLC"), false);
  });

  it("merges under every Sarvah-card store, not only Sarvah Homes", () => {
    assert.equal(
      shouldMergeSarvahHomesInventory("sarvah", "SARVAH HOMES L L C"),
      true,
    );
    assert.equal(
      shouldMergeSarvahHomesInventory("sarvah", "002 - RAMEZ"),
      true,
    );
    assert.equal(
      shouldMergeSarvahHomesInventory("shmp", "SARVAH HOMES L L C"),
      false,
    );
  });

  it("appends the SHMP Sarvah Homes store once", () => {
    const classic: StoreProfile[] = [
      { _id: "c1", storeName: "Day to Day Sharjah" },
    ];
    const shmp: StoreProfile[] = [
      { _id: "h1", storeName: "SARVAH HOMES L L C" },
      { _id: "h2", storeName: "ALFARAH GENERAL TRADING LLC" },
      { _id: "h1", storeName: "SARVAH HOMES L L C" },
    ];
    const merged = withSarvahHomesShmpStores(classic, shmp);
    assert.deepEqual(
      merged.map((store) => store._id),
      ["c1", "h1"],
    );
  });

  it("keeps Sarvah catalogue rows and adds assigned SHMP-only products", () => {
    const sarvah = [
      { _id: "a", itemName: "Alpha" },
      { _id: "b", itemName: "Beta" },
    ] as Product[];
    const shmp = [
      { _id: "b", itemName: "Beta manufacturing duplicate" },
      { _id: "c", itemName: "Carton" },
    ] as Product[];
    const merged = mergeSarvahAndAssignedShmpProducts(sarvah, shmp);
    assert.deepEqual(
      merged.map((product) => product._id),
      ["a", "b", "c"],
    );
    assert.equal(merged.find((product) => product._id === "b")?.itemName, "Beta");
  });
});

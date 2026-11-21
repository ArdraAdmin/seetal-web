import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSarvahHomesStoreName,
  shouldMergeSarvahHomesInventory,
  shouldShowSarvahHomesUnderSarvah,
  withSarvahHomesShmpStores,
} from "./sarvah-homes-sales.ts";
import type { StoreProfile } from "./types.ts";

describe("sarvah homes sales helpers", () => {
  it("recognises Sarvah Homes store name variants", () => {
    assert.equal(isSarvahHomesStoreName("SARVAH HOMES L L C"), true);
    assert.equal(isSarvahHomesStoreName("Sarvah Homes"), true);
    assert.equal(isSarvahHomesStoreName("ALFARAH GENERAL TRADING LLC"), false);
  });

  it("never merges SHMP manufacturing inventory into selling workspaces", () => {
    assert.equal(
      shouldMergeSarvahHomesInventory("sarvah", "SARVAH HOMES L L C"),
      false,
    );
    assert.equal(shouldMergeSarvahHomesInventory("sarvah", "002 - RAMEZ"), false);
    assert.equal(shouldMergeSarvahHomesInventory("stl", "Any store"), false);
    assert.equal(shouldMergeSarvahHomesInventory("shlaxmi", "Any store"), false);
    assert.equal(
      shouldMergeSarvahHomesInventory("shmp", "SARVAH HOMES L L C"),
      false,
    );
  });

  it("still surfaces Sarvah Homes under the Sarvah store list", () => {
    assert.equal(shouldShowSarvahHomesUnderSarvah("sarvah"), true);
    assert.equal(shouldShowSarvahHomesUnderSarvah("stl"), false);
    assert.equal(shouldShowSarvahHomesUnderSarvah("shmp"), false);
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
});

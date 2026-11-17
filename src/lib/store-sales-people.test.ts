import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterVisibleStoreSalesPeople,
  filterVisibleStoreSalesPersonIds,
  isHiddenStoreSalesPersonId,
} from "./store-sales-people.ts";

describe("store sales people", () => {
  it("hides the known dummy sales id", () => {
    assert.equal(isHiddenStoreSalesPersonId("5fc61c984438d90017ff7132"), true);
    assert.equal(isHiddenStoreSalesPersonId("real-user"), false);
  });

  it("filters people and id lists", () => {
    const people = filterVisibleStoreSalesPeople([
      { _id: "5fc61c984438d90017ff7132", name: "Dummy" },
      { _id: "abc", name: "Real" },
    ]);
    assert.deepEqual(
      people.map((person) => person._id),
      ["abc"],
    );
    assert.deepEqual(
      filterVisibleStoreSalesPersonIds([
        "5fc61c984438d90017ff7132",
        "abc",
      ]),
      ["abc"],
    );
  });
});

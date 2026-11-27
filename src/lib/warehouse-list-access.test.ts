import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  warehouseListAllowed,
  warehouseListFlagsFromRecord,
} from "./warehouse-list-access.ts";

describe("warehouseListAllowed", () => {
  const allOn = { customs: true, loadList: true, zeroList: true };

  it("shows every list to an admin", () => {
    assert.equal(warehouseListAllowed({ role: "Admin" }, "customs"), true);
    assert.equal(warehouseListAllowed({ role: "Admin" }, "daily"), true);
    assert.equal(warehouseListAllowed({ role: "Admin" }, "loading"), true);
  });

  it("shows a warehouse user only the lists that are switched on", () => {
    const user = {
      role: "Warehouse",
      warehouseLists: { customs: true, loadList: false, zeroList: false },
    };
    assert.equal(warehouseListAllowed(user, "customs"), true);
    assert.equal(warehouseListAllowed(user, "loading"), false);
    assert.equal(warehouseListAllowed(user, "daily"), false);
  });

  it("shows all three lists when every switch is on", () => {
    const user = { role: "Warehouse", warehouseLists: allOn };
    assert.equal(warehouseListAllowed(user, "customs"), true);
    assert.equal(warehouseListAllowed(user, "daily"), true);
    assert.equal(warehouseListAllowed(user, "loading"), true);
  });

  it("hides every list when the warehouse user has no switches", () => {
    assert.equal(warehouseListAllowed({ role: "Warehouse" }, "customs"), false);
  });
});

describe("warehouseListFlagsFromRecord", () => {
  it("treats anything other than true as off", () => {
    assert.deepEqual(
      warehouseListFlagsFromRecord({ customs: true, loadList: "true", zeroList: 1 }),
      { customs: true, loadList: false, zeroList: false },
    );
  });
});

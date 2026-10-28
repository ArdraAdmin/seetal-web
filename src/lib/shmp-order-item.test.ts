import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMarkOrderItemComplete,
  isOrderItemDone,
} from "./shmp-order-item.ts";

describe("isOrderItemDone", () => {
  it("is true only for Done", () => {
    assert.equal(isOrderItemDone("Done"), true);
    assert.equal(isOrderItemDone("Assigned"), false);
    assert.equal(isOrderItemDone("Pending"), false);
    assert.equal(isOrderItemDone(""), false);
  });
});

describe("canMarkOrderItemComplete", () => {
  it("shows the action after a worker is assigned", () => {
    assert.equal(
      canMarkOrderItemComplete({ productionStatus: "Assigned" }),
      true,
    );
    assert.equal(
      canMarkOrderItemComplete({
        productionStatus: "Pending",
        assignedWorkers: [{ employeeId: "w1" }],
      }),
      true,
    );
  });

  it("hides the action when the item is already done or unassigned", () => {
    assert.equal(
      canMarkOrderItemComplete({ productionStatus: "Done" }),
      false,
    );
    assert.equal(
      canMarkOrderItemComplete({
        productionStatus: "Done",
        assignedWorkers: [{ employeeId: "w1" }],
      }),
      false,
    );
    assert.equal(
      canMarkOrderItemComplete({ productionStatus: "Pending" }),
      false,
    );
    assert.equal(canMarkOrderItemComplete({}), false);
  });
});

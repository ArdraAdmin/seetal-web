import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMarkOrderItemComplete,
  isOrderItemDone,
  parseSplitAssignments,
  remainingCartons,
} from "./shmp-order-item.ts";

describe("parseSplitAssignments", () => {
  it("accepts a split that fits the unpacked cartons", () => {
    assert.deepEqual(
      parseSplitAssignments(
        [
          { employeeId: "a", cartonQty: "20" },
          { employeeId: "b", cartonQty: "30" },
        ],
        100,
      ),
      {
        ok: true,
        workers: [
          { employeeId: "a", cartonQty: 20 },
          { employeeId: "b", cartonQty: 30 },
        ],
      },
    );
  });

  it("rejects a split that packs more than is left", () => {
    const result = parseSplitAssignments(
      [
        { employeeId: "a", cartonQty: "20" },
        { employeeId: "b", cartonQty: "30" },
      ],
      40,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /40 cartons/);
    }
  });

  it("rejects a missing worker or a repeated worker", () => {
    assert.equal(
      parseSplitAssignments([{ employeeId: "", cartonQty: "10" }], 10).ok,
      false,
    );
    assert.equal(
      parseSplitAssignments(
        [
          { employeeId: "a", cartonQty: "10" },
          { employeeId: "a", cartonQty: "5" },
        ],
        100,
      ).ok,
      false,
    );
  });
});

describe("remainingCartons", () => {
  it("uses the unpacked quantity from the order line", () => {
    assert.equal(remainingCartons({ remainingProduction: 40, ordered: 100 }), 40);
    assert.equal(remainingCartons({ ordered: 100, produced: 25 }), 75);
    assert.equal(remainingCartons({ remainingProduction: 0, ordered: 10 }), 0);
  });
});

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

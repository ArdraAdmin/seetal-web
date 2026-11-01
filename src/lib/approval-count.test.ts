import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pendingApprovalCount } from "./approval-count.ts";

describe("pending approval count", () => {
  it("counts only orders still waiting for a decision", () => {
    assert.equal(
      pendingApprovalCount([
        { approvalStatus: "pending" },
        { approvalStatus: "approved" },
        { approvalStatus: "rejected" },
        { approvalStatus: "pending" },
        {},
      ]),
      3,
    );
  });

  it("is zero when nothing is waiting", () => {
    assert.equal(
      pendingApprovalCount([
        { approvalStatus: "approved" },
        { approvalStatus: "rejected" },
        { approvalStatus: "none" },
      ]),
      0,
    );
  });
});

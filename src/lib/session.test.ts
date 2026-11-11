import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRejectedSessionStatus,
  remoteSessionDecision,
} from "./session.ts";

describe("archived session checks", () => {
  it("treats only 401 as a session the server has ended", () => {
    assert.equal(isRejectedSessionStatus(401), true);
    assert.equal(isRejectedSessionStatus(400), false);
    assert.equal(isRejectedSessionStatus(403), false);
    assert.equal(isRejectedSessionStatus(404), false);
    assert.equal(isRejectedSessionStatus(500), false);
  });

  it("keeps the session when the archive check does not finish", () => {
    assert.equal(remoteSessionDecision(null), "unknown");
    assert.equal(remoteSessionDecision(401), "reject");
    assert.equal(remoteSessionDecision(200), "allow");
    assert.equal(remoteSessionDecision(404), "unknown");
    assert.equal(remoteSessionDecision(500), "unknown");
  });
});

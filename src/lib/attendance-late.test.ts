import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLateCheckIn, isMorningShift } from "./attendance-late.ts";

describe("isLateCheckIn", () => {
  it("treats morning and day as the morning shift", () => {
    assert.equal(isMorningShift("day"), true);
    assert.equal(isMorningShift("Morning"), true);
    assert.equal(isMorningShift("night"), false);
    assert.equal(isMorningShift(""), false);
  });

  it("marks a morning check-in after 5:45 AM Dubai as late", () => {
    assert.equal(isLateCheckIn("day", "2026-08-01T01:30:00.000Z"), false);
    assert.equal(isLateCheckIn("morning", "2026-08-01T01:45:00.000Z"), false);
    assert.equal(isLateCheckIn("day", "2026-08-01T01:45:01.000Z"), true);
    assert.equal(isLateCheckIn("morning", "2026-08-01T02:00:00.000Z"), true);
  });

  it("does not mark night shift or a missing check-in", () => {
    assert.equal(isLateCheckIn("night", "2026-08-01T14:00:00.000Z"), false);
    assert.equal(isLateCheckIn("", "2026-08-01T02:00:00.000Z"), false);
    assert.equal(isLateCheckIn("day", null), false);
    assert.equal(isLateCheckIn("day", ""), false);
  });
});

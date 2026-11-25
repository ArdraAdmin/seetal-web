import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hrShiftName,
  hrShiftOptionLabel,
  normalizeHrShift,
} from "./hr-shift.ts";

describe("normalizeHrShift", () => {
  it("maps day, night, and the old morning label", () => {
    assert.equal(normalizeHrShift("day"), "day");
    assert.equal(normalizeHrShift("NIGHT"), "night");
    assert.equal(normalizeHrShift("morning"), "day");
    assert.equal(normalizeHrShift(""), "");
    assert.equal(normalizeHrShift("swing"), "");
  });
});

describe("hr shift labels", () => {
  it("names the two windows", () => {
    assert.equal(hrShiftName("morning"), "Day");
    assert.equal(hrShiftName("night"), "Night");
    assert.equal(hrShiftOptionLabel("day"), "Day (5:30 AM – 5:30 PM)");
    assert.equal(hrShiftOptionLabel("night"), "Night (5:30 PM – 5:30 AM)");
  });
});

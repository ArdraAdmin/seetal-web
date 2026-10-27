import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FACTORY_SHIFTS,
  clockMinutesInZone,
  currentShift,
  parseHhmm,
  shiftContainsMinutes,
  shiftLabel,
} from "./shmp-shift.ts";

const morning = DEFAULT_FACTORY_SHIFTS[0];
const night = DEFAULT_FACTORY_SHIFTS[1];

describe("parseHhmm", () => {
  it("parses factory times", () => {
    assert.equal(parseHhmm("06:00"), 360);
    assert.equal(parseHhmm("18:00"), 1080);
    assert.equal(parseHhmm("bad"), null);
  });
});

describe("clockMinutesInZone", () => {
  it("uses Asia/Dubai, not the machine timezone", () => {
    // 14:00 UTC is 18:00 in Dubai (UTC+4).
    assert.equal(
      clockMinutesInZone(new Date("2026-10-27T14:00:00.000Z")),
      18 * 60,
    );
    // 02:00 UTC is 06:00 in Dubai.
    assert.equal(
      clockMinutesInZone(new Date("2026-10-27T02:00:00.000Z")),
      6 * 60,
    );
  });
});

describe("shiftContainsMinutes", () => {
  it("puts 06:00–17:59 in morning and 18:00–05:59 in night", () => {
    assert.equal(shiftContainsMinutes(morning, 6 * 60), true);
    assert.equal(shiftContainsMinutes(morning, 17 * 60 + 59), true);
    assert.equal(shiftContainsMinutes(morning, 18 * 60), false);
    assert.equal(shiftContainsMinutes(night, 18 * 60), true);
    assert.equal(shiftContainsMinutes(night, 5 * 60 + 59), true);
    assert.equal(shiftContainsMinutes(night, 6 * 60), false);
  });
});

describe("currentShift", () => {
  it("selects morning and night from the current Dubai time", () => {
    assert.equal(
      currentShift(DEFAULT_FACTORY_SHIFTS, new Date("2026-10-27T04:00:00.000Z"))
        ?.code,
      "MORNING",
    );
    assert.equal(
      currentShift(DEFAULT_FACTORY_SHIFTS, new Date("2026-10-27T14:30:00.000Z"))
        ?.code,
      "NIGHT",
    );
    assert.equal(
      currentShift(DEFAULT_FACTORY_SHIFTS, new Date("2026-10-27T01:59:00.000Z"))
        ?.code,
      "NIGHT",
    );
  });

  it("returns null when there are no shifts", () => {
    assert.equal(currentShift([], new Date()), null);
  });
});

describe("shiftLabel", () => {
  it("shows the window so the operator can see what was picked", () => {
    assert.equal(shiftLabel(morning), "Morning (06:00–18:00)");
    assert.equal(shiftLabel(null), "");
  });
});

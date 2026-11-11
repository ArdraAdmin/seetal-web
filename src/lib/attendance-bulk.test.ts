import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceDatesInRange,
  filterAttendancePeople,
  holidayStatusAvailable,
  mapWithLimit,
  setVisibleSelection,
  toggleSelectedId,
} from "./attendance-bulk.ts";

const people = [
  { id: "worker:1", label: "Amina (Worker)" },
  { id: "portal:2", label: "Ravi (Supervisor)" },
  { id: "staff:3", label: "Leena (HR)" },
];

describe("attendance bulk selection", () => {
  it("filters people by name or role", () => {
    assert.deepEqual(
      filterAttendancePeople(people, "  ravi ").map((person) => person.id),
      ["portal:2"],
    );
    assert.equal(filterAttendancePeople(people, "").length, 3);
  });

  it("toggles one id without dropping the others", () => {
    assert.deepEqual(toggleSelectedId(["worker:1"], "portal:2"), [
      "worker:1",
      "portal:2",
    ]);
    assert.deepEqual(toggleSelectedId(["worker:1", "portal:2"], "worker:1"), [
      "portal:2",
    ]);
  });

  it("selects visible people and leaves hidden selections in place", () => {
    assert.deepEqual(
      setVisibleSelection(["staff:3"], ["worker:1", "portal:2"], true),
      ["staff:3", "worker:1", "portal:2"],
    );
    assert.deepEqual(
      setVisibleSelection(
        ["staff:3", "worker:1", "portal:2"],
        ["worker:1", "portal:2"],
        false,
      ),
      ["staff:3"],
    );
  });

  it("allows holiday for any selected person", () => {
    assert.equal(holidayStatusAvailable([]), false);
    assert.equal(holidayStatusAvailable(["worker:1", "portal:2"]), true);
  });

  it("lists every day in a holiday range", () => {
    assert.deepEqual(attendanceDatesInRange("2026-11-05", "2026-11-12"), [
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
    assert.equal(attendanceDatesInRange("2026-11-12", "2026-11-05"), null);
  });

  it("runs saves with a concurrency cap and keeps failures", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithLimit(["a", "b", "c", "d"], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (item === "c") throw new Error("no company");
      return item;
    });
    assert.equal(peak, 2);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[2].status, "rejected");
    assert.equal(results.filter((row) => row.status === "fulfilled").length, 3);
  });
});

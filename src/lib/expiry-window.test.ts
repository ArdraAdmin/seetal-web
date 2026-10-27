import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPIRY_ALERT_DAYS,
  calendarDaysUntil,
  dubaiDateOnly,
  expiryUrgencyLabel,
  isExpiringWithinDays,
  mulkyaAlertsFromVehicles,
  visaAlertHref,
  visaAlertsFromDashboard,
} from "./expiry-window.ts";

/** Tuesday 27 Oct 2026, 12:00 Dubai (08:00 UTC). */
const NOW = Date.parse("2026-10-27T08:00:00Z");

describe("expiry window", () => {
  it("reads the Dubai calendar date", () => {
    assert.equal(dubaiDateOnly(NOW), "2026-10-27");
    assert.equal(dubaiDateOnly(Date.parse("2026-10-26T20:30:00Z")), "2026-10-27");
  });

  it("counts whole Dubai calendar days until expiry", () => {
    assert.equal(calendarDaysUntil("2026-10-27", NOW), 0);
    assert.equal(calendarDaysUntil("2026-10-26", NOW), -1);
    assert.equal(calendarDaysUntil("2026-11-11", NOW), 15);
    assert.equal(calendarDaysUntil("2026-11-12", NOW), 16);
    assert.equal(calendarDaysUntil("2027-03-15", NOW), 139);
    assert.equal(calendarDaysUntil("", NOW), null);
    assert.equal(calendarDaysUntil(undefined, NOW), null);
  });

  it("treats ISO timestamps as Dubai calendar dates", () => {
    assert.equal(calendarDaysUntil("2026-11-11T20:00:00.000Z", NOW), 15);
  });

  it("includes overdue and the 15th day, excludes the 16th", () => {
    assert.equal(EXPIRY_ALERT_DAYS, 15);
    assert.equal(isExpiringWithinDays("2026-10-20", EXPIRY_ALERT_DAYS, NOW), true);
    assert.equal(isExpiringWithinDays("2026-10-27", EXPIRY_ALERT_DAYS, NOW), true);
    assert.equal(isExpiringWithinDays("2026-11-11", EXPIRY_ALERT_DAYS, NOW), true);
    assert.equal(isExpiringWithinDays("2026-11-12", EXPIRY_ALERT_DAYS, NOW), false);
    assert.equal(isExpiringWithinDays(null, EXPIRY_ALERT_DAYS, NOW), false);
  });

  it("labels urgency in plain language", () => {
    assert.equal(expiryUrgencyLabel(-3), "Expired 3 days ago");
    assert.equal(expiryUrgencyLabel(-1), "Expired 1 day ago");
    assert.equal(expiryUrgencyLabel(0), "Expires today");
    assert.equal(expiryUrgencyLabel(1), "Expires tomorrow");
    assert.equal(expiryUrgencyLabel(8), "In 8 days");
  });

  it("routes visa alerts to the matching HR record", () => {
    assert.equal(
      visaAlertHref({ id: "w1", source: "employee" }),
      "/shmp/hr/worker/w1",
    );
    assert.equal(
      visaAlertHref({ id: "s1", source: "user", role: "Sales" }),
      "/shmp/hr/user/s1",
    );
    assert.equal(
      visaAlertHref({ id: "u1", source: "user", role: "Warehouse" }),
      "/admin/hr/u1",
    );
  });

  it("builds mulkiya alerts sorted by soonest expiry", () => {
    const rows = mulkyaAlertsFromVehicles(
      [
        { _id: "late", value: 200, mulkyaExpiry: "2026-11-12" },
        { _id: "soon", value: 37288, mulkyaExpiry: "2026-11-05" },
        { _id: "overdue", value: 100, mulkyaExpiry: "2026-10-20" },
        { _id: "none", value: 9, mulkyaExpiry: null },
      ],
      NOW,
    );
    assert.deepEqual(
      rows.map((row) => row.id),
      ["overdue", "soon"],
    );
    assert.equal(rows[0].daysRemaining, -7);
    assert.equal(rows[1].href, "/admin/vehicles/soon");
    assert.equal(rows[1].title, "Vehicle #37288");
  });

  it("builds visa alerts from dashboard employees and users", () => {
    const rows = visaAlertsFromDashboard(
      {
        employees: [
          {
            id: "e1",
            name: "Factory Ali",
            source: "employee",
            expiryDate: "2026-11-01",
          },
        ],
        users: [
          {
            id: "u1",
            name: "Warehouse Sara",
            email: "sara@example.com",
            source: "user",
            role: "Warehouse",
            expiryDate: "2026-10-28",
          },
          {
            id: "u2",
            name: "Too far",
            source: "user",
            role: "Warehouse",
            expiryDate: "2026-12-01",
          },
        ],
      },
      NOW,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].title, "Warehouse Sara");
    assert.equal(rows[0].href, "/admin/hr/u1");
    assert.equal(rows[1].href, "/shmp/hr/worker/e1");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  monthlySalesHref,
  opsStatsFromDashboard,
  salesmanBreakdownHref,
} from "./admin-kpi.ts";
import type { AdminKpiDashboard } from "./stl-features-api.ts";

function kpi(
  overrides: Partial<AdminKpiDashboard> = {},
): AdminKpiDashboard {
  return {
    now: { date: "2026-10-28", time: "12:00:00", timezone: "Asia/Dubai" },
    companyKey: "stl",
    companyId: "c1",
    topSalesman: null,
    topProducts: [],
    salesmanGraph: [],
    monthlySales: {
      current: { year: 2026, month: 10, total: 0 },
      previous: { year: 2026, month: 9, total: 0 },
      delta: 0,
      deltaPct: null,
    },
    users: {
      total: 40,
      salesmen: 20,
      warehouse: 12,
      admins: 6,
      supervisors: 2,
    },
    inventoryValue: 0,
    salesLost: { totalLost: 0, lineCount: 0, year: 2026, month: 10 },
    visaExpiry: { count: 0, employees: [], users: [] },
    counts: {
      stores: 1800,
      expiredTradeLicenses: 9,
      pendingApprovals: 4,
      inventorySkus: 3200,
    },
    ...overrides,
  };
}

describe("opsStatsFromDashboard", () => {
  it("maps dashboard counts so the homepage does not fetch full lists", () => {
    assert.deepEqual(opsStatsFromDashboard(kpi()), {
      totalUsers: 40,
      totalSalesman: 20,
      totalWarehouseUsers: 12,
      totalStores: 1800,
      expiredTradeLicenses: 9,
      pendingApprovals: 4,
      totalInventory: 3200,
    });
  });

  it("builds dashboard drill-down hrefs", () => {
    assert.equal(monthlySalesHref("stl"), "/admin/monthly-sales?company=stl");
    assert.equal(
      salesmanBreakdownHref("abc 1", "shmp"),
      "/admin/salesmen/abc%201?company=shmp",
    );
  });

  it("leaves ops tiles empty when the API has not sent counts yet", () => {
    const withoutCounts = kpi();
    delete withoutCounts.counts;
    assert.deepEqual(opsStatsFromDashboard(withoutCounts), {
      totalUsers: 40,
      totalSalesman: 20,
      totalWarehouseUsers: 12,
    });
    assert.deepEqual(opsStatsFromDashboard(null), {});
  });
});

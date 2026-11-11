import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminKpiDashboard } from "./stl-features-api.ts";
import {
  summarizeShmpDeliveries,
  withShmpDeliveredSales,
} from "./shmp-delivered-sales.ts";

const now = new Date("2026-11-11T10:00:00.000Z");

function kpi(total: number): AdminKpiDashboard {
  return {
    now: { date: "11 Nov 2026", time: "14:00", timezone: "Asia/Dubai" },
    companyKey: "shmp",
    companyId: "shmp",
    topSalesman: {
      salesId: "nikesh",
      name: "Nikesh",
      delivered: 1613.25,
      target: null,
      progress: null,
    },
    topProducts: [
      { productId: "p", name: "Box", revenue: total, qty: 10 },
    ],
    salesmanGraph: [
      {
        salesId: "nikesh",
        name: "Nikesh",
        delivered: 1613.25,
        target: null,
        stl: 0,
        shmp: 1613.25,
      },
    ],
    monthlySales: {
      current: { year: 2026, month: 11, total },
      previous: { year: 2026, month: 10, total: 342100 },
      delta: total - 342100,
      deltaPct: -98.1,
    },
    users: { total: 1, salesmen: 1, warehouse: 0, admins: 0, supervisors: 0 },
    inventoryValue: 0,
    salesLost: { totalLost: 0, lineCount: 0, year: 2026, month: 11 },
    visaExpiry: { count: 0, employees: [], users: [] },
  };
}

describe("summarizeShmpDeliveries", () => {
  it("stays at zero until an order is delivered", () => {
    const summary = summarizeShmpDeliveries([], [], now);
    assert.equal(summary.currentTotal, 0);
    assert.equal(summary.previousTotal, 0);
    assert.deepEqual(summary.products, []);
    assert.deepEqual(summary.salesmen, []);
  });

  it("counts only trips in the Dubai month, not confirmed orders from another month", () => {
    const summary = summarizeShmpDeliveries(
      [
        {
          deliveryDate: "2026-11-05T08:00:00.000Z",
          totalValue: 500,
          tempOrder: { sales: { _id: "nikesh", name: "Nikesh" } },
          lines: [
            {
              product: { _id: "box", itemName: "Storage box", itemRef: "SH-1" },
              qty: 5,
              lineValue: 500,
            },
          ],
        },
        {
          deliveryDate: "2026-10-20T08:00:00.000Z",
          totalValue: 9000,
          lines: [],
        },
      ],
      [
        {
          deliveryDate: "2026-10-20T08:00:00.000Z",
          totalValue: 80,
          lines: [],
        },
      ],
      now,
    );
    assert.equal(summary.currentTotal, 500);
    assert.equal(summary.previousTotal, 80);
    assert.equal(summary.products[0].name, "Storage box");
    assert.equal(summary.salesmen[0].delivered, 500);
  });
});

describe("withShmpDeliveredSales", () => {
  it("replaces confirmed-order sales when nothing has been delivered", () => {
    const next = withShmpDeliveredSales(
      kpi(6384.26),
      summarizeShmpDeliveries([], [], now),
    );
    assert.equal(next.monthlySales.current.total, 0);
    assert.equal(next.monthlySales.previous.total, 0);
    assert.equal(next.topSalesman, null);
    assert.deepEqual(next.topProducts, []);
    assert.deepEqual(next.salesmanGraph, []);
  });
});

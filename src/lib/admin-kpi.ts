import type { DashboardStats } from "./api";
import type { AdminKpiDashboard } from "./stl-features-api";

export function opsStatsFromDashboard(
  kpi: AdminKpiDashboard | null,
): Partial<DashboardStats> {
  if (!kpi) return {};
  const stats: Partial<DashboardStats> = {};
  if (kpi.users) {
    stats.totalUsers = kpi.users.total;
    stats.totalSalesman = kpi.users.salesmen;
    stats.totalWarehouseUsers = kpi.users.warehouse;
  }
  if (kpi.counts) {
    stats.totalStores = kpi.counts.stores;
    stats.expiredTradeLicenses = kpi.counts.expiredTradeLicenses;
    stats.pendingApprovals = kpi.counts.pendingApprovals;
    stats.totalInventory = kpi.counts.inventorySkus;
  }
  return stats;
}

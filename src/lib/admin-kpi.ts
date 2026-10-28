import type { DashboardStats } from "./api";
import type { AdminKpiDashboard, CompanyKey } from "./stl-features-api";

export function monthlySalesHref(companyKey: CompanyKey) {
  return `/admin/monthly-sales?company=${encodeURIComponent(companyKey)}`;
}

export function salesmanBreakdownHref(
  salesId: string,
  companyKey: CompanyKey,
) {
  return `/admin/salesmen/${encodeURIComponent(salesId)}?company=${encodeURIComponent(companyKey)}`;
}

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

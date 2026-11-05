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

/**
 * STL dashboard users are sales, warehouse, and the portal admins.
 * Supervisors stay on SHMP, and other Admin-role logins are not counted here.
 */
export function stlDashboardUsers(
  users: AdminKpiDashboard["users"],
): AdminKpiDashboard["users"] {
  const salesmen = users.salesmen || 0;
  const warehouse = users.warehouse || 0;
  const admins = users.admins || 0;
  return {
    ...users,
    salesmen,
    warehouse,
    admins,
    supervisors: 0,
    total: salesmen + warehouse + admins,
  };
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

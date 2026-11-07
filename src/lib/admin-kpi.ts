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

export function dashboardInventoryHref(side: CompanyKey) {
  return side === "shmp" ? "/shmp/inventory" : "/admin/inventory";
}

export function dashboardStoresHref(side: CompanyKey) {
  return side === "shmp" ? "/shmp/stores" : "/admin/stores";
}

export type DashboardCardSet = {
  thisMonth: boolean;
  inventoryValue: boolean;
  topSalesman: boolean;
  salesLost: boolean;
  attention: boolean;
  users: boolean;
  stores: boolean;
  warehouseUsers: boolean;
  inventorySkus: boolean;
  monthlySales: boolean;
  userMix: boolean;
  topProducts: boolean;
  salesBySalesman: boolean;
};

/** STL keeps fleet and portal cards. SHMP keeps the commercial cards only. */
export function dashboardCardsForSide(side: CompanyKey): DashboardCardSet {
  const commercial = {
    thisMonth: true,
    inventoryValue: true,
    topSalesman: true,
    stores: true,
    inventorySkus: true,
    monthlySales: true,
    topProducts: true,
    salesBySalesman: true,
  };
  if (side === "shmp") {
    return {
      ...commercial,
      salesLost: false,
      attention: false,
      users: false,
      warehouseUsers: false,
      userMix: false,
    };
  }
  return {
    ...commercial,
    salesLost: true,
    attention: true,
    users: true,
    warehouseUsers: true,
    userMix: true,
  };
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

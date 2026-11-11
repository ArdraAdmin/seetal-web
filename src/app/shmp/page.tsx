"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getApprovalQueue, getCompanies, getMulkyaAlerts } from "@/lib/api";
import {
  isFreshShmpInventory,
  shmpDashboard,
  shmpInventory,
  shmpStores,
  type ShmpDashboardSummary,
  type ShmpInventoryProduct,
  type ShmpStaffCounts,
} from "@/lib/shmp-api";
import {
  loadShmpDeliveredSales,
  summarizeShmpDeliveries,
  withShmpDeliveredSales,
} from "@/lib/shmp-delivered-sales";
import { useAuth } from "@/components/AuthProvider";
import { KpiDashboard } from "@/components/KpiDashboard";
import { SecondaryButton } from "@/components/ui";
import { portalFieldVisible } from "@/lib/custom-users";
import { shmpCatalogueParams } from "@/app/shmp/inventory/catalogue-load";
import {
  attendanceFilterHref,
  categorySliceTotal,
  shmpInventoryCategoryRows,
  shmpStockSnapshot,
} from "@/lib/shmp-dashboard";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import { countPendingForCompany } from "@/lib/approval-count";
import {
  EXPIRY_ALERT_DAYS,
  isExpiringWithinDays,
  type ExpiryAlertRow,
} from "@/lib/expiry-window";
import { opsStatsFromDashboard } from "@/lib/admin-kpi";
import {
  getAdminKpiDashboard,
  type AdminKpiDashboard,
} from "@/lib/stl-features-api";

const emptyStaff: ShmpStaffCounts = {
  present: 0,
  absent: 0,
  leave: 0,
  holiday: 0,
  half_day: 0,
};

const PIE_COLORS = [
  "#0e3a32",
  "#f7a51c",
  "#2a6f62",
  "#c9840f",
  "#6b8f88",
  "#d4a24a",
  "#1a4d44",
  "#e8c27a",
];

type CategorySlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export default function ShmpDashboardPage() {
  const { user } = useAuth();
  const show = (fieldId: string) =>
    portalFieldVisible(user?.customAccess, "shmp", "dashboard", fieldId);
  const [data, setData] = useState<ShmpDashboardSummary | null>(null);
  const [hasOwnInventory, setHasOwnInventory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<AdminKpiDashboard | null>(null);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [licenseCount, setLicenseCount] = useState<number | null>(null);
  const [approvalCount, setApprovalCount] = useState<number | null>(null);
  const [mulkyaAlerts, setMulkyaAlerts] = useState<ExpiryAlertRow[]>([]);
  const [mulkyaLoading, setMulkyaLoading] = useState(true);
  const [ownProducts, setOwnProducts] = useState<ShmpInventoryProduct[]>([]);
  const [stock, setStock] = useState<{ skus: number; value: number } | null>(
    null,
  );
  const [epoch, setEpoch] = useState(0);

  const reload = () => {
    setLoading(true);
    setKpiLoading(true);
    setMulkyaLoading(true);
    setEpoch((value) => value + 1);
  };

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);
    let cancelled = false;

    void (async () => {
      const [summaryResult, companiesResult, storesResult, kpiResult, mulkyaResult, approvalsResult, deliveredResult] =
        await Promise.allSettled([
          shmpDashboard({ signal: controller.signal }),
          getCompanies(),
          shmpStores(),
          getAdminKpiDashboard(userId, { companyKey: "shmp" }),
          getMulkyaAlerts("shmp"),
          getApprovalQueue(),
          loadShmpDeliveredSales(),
        ]);
      if (cancelled) return;

      const companies =
        companiesResult.status === "fulfilled" && Array.isArray(companiesResult.value)
          ? companiesResult.value
          : [];
      const companyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";
      let products: Awaited<ReturnType<typeof shmpInventory>> = [];
      let productsOk = false;
      try {
        products = await shmpInventory(
          shmpCatalogueParams("", companyId),
          controller.signal,
        );
        productsOk = true;
      } catch {
        productsOk = false;
      }
      if (cancelled) return;

      if (summaryResult.status === "fulfilled") {
        setData(summaryResult.value);
        setError(null);
      } else {
        const reason = summaryResult.reason;
        const aborted =
          reason instanceof DOMException && reason.name === "AbortError";
        setData(null);
        setError(
          aborted
            ? "Dashboard request timed out"
            : reason instanceof Error
              ? reason.message
              : "Failed to load",
        );
      }

      if (productsOk) {
        const list = Array.isArray(products) ? products : [];
        const own = list.filter((product) => isFreshShmpInventory(product));
        setHasOwnInventory(own.length > 0);
        setOwnProducts(own);
        setStock(shmpStockSnapshot(own));
      } else {
        setHasOwnInventory(false);
        setOwnProducts([]);
        setStock(null);
      }

      if (storesResult.status === "fulfilled") {
        const rows = Array.isArray(storesResult.value) ? storesResult.value : [];
        setStoreCount(rows.length);
        setLicenseCount(
          rows.filter((store) =>
            isExpiringWithinDays(store.tradeLicenseExpiry, EXPIRY_ALERT_DAYS),
          ).length,
        );
      } else {
        setStoreCount(null);
        setLicenseCount(null);
      }

      if (mulkyaResult.status === "fulfilled") {
        setMulkyaAlerts(mulkyaResult.value.vehicles || []);
      } else {
        setMulkyaAlerts([]);
      }
      setMulkyaLoading(false);

      const shmpCompanyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";
      if (approvalsResult.status === "fulfilled" && shmpCompanyId) {
        setApprovalCount(
          countPendingForCompany(approvalsResult.value, shmpCompanyId),
        );
      } else if (approvalsResult.status === "fulfilled") {
        setApprovalCount(0);
      } else {
        setApprovalCount(null);
      }

      if (kpiResult.status === "fulfilled") {
        const delivered =
          deliveredResult.status === "fulfilled"
            ? deliveredResult.value
            : summarizeShmpDeliveries([], []);
        setKpi(withShmpDeliveredSales(kpiResult.value, delivered));
        setKpiError(null);
      } else {
        const reason = kpiResult.reason;
        setKpi(null);
        setKpiError(
          reason instanceof Error ? reason.message : "Failed to load KPIs",
        );
      }

      window.clearTimeout(timer);
      setLoading(false);
      setKpiLoading(false);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [user?.id, epoch]);

  const staffToday = data?.staffToday || emptyStaff;
  const byCat = useMemo(() => {
    const rows = shmpInventoryCategoryRows(ownProducts);
    return rows.map((row, i) => ({
      ...row,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [ownProducts]);
  const inventoryByCategory = categorySliceTotal(byCat);
  const attentionStats = {
    ...opsStatsFromDashboard(kpi),
    ...(licenseCount != null ? { expiredTradeLicenses: licenseCount } : {}),
    ...(approvalCount != null ? { pendingApprovals: approvalCount } : {}),
  };
  const onHoliday = (staffToday.leave || 0) + (staffToday.holiday || 0);
  const rangeLabel =
    data?.from && data?.to
      ? `${formatDate(data.from)} – ${formatDate(data.to)}`
      : null;

  const showToday =
    show("present") ||
    show("absent") ||
    show("holiday") ||
    show("ready-cartons");
  const today =
    error && !data ? null : showToday ? (
      <section className="space-y-3">
        <DashLabel>Today</DashLabel>
        {loading && !data ? (
          <p className="text-sm text-slate-500">Loading factory totals…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {show("present") ? (
              <Metric
                label="Present today"
                value={String(staffToday.present || 0)}
                href={attendanceFilterHref("present")}
              />
            ) : null}
            {show("absent") ? (
              <Metric
                label="Absent today"
                value={String(staffToday.absent || 0)}
                href={attendanceFilterHref("absent")}
              />
            ) : null}
            {show("holiday") ? (
              <Metric
                label="On holiday today"
                value={String(onHoliday)}
                href={attendanceFilterHref("leave")}
              />
            ) : null}
            {show("ready-cartons") ? (
              <Metric
                label="Cartons ready for delivery"
                value={String(Number(data?.totalReadyQty) || 0)}
                href="/shmp/orders?section=ready"
              />
            ) : null}
          </div>
        )}
      </section>
    ) : null;

  const category =
    show("sales-by-category") && !(error && !data) ? (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(14,58,50,0.04)] lg:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Inventory value by category
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              On-hand value of SHMP production stock. Catalogue items that
              are not SHMP inventory are left out.
            </p>
          </div>
          <p className="text-lg font-semibold text-ink">
            {formatMoney(inventoryByCategory)}
          </p>
        </div>
        {loading && !data ? (
          <p className="mt-4 text-sm text-slate-500">Loading inventory…</p>
        ) : byCat.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {hasOwnInventory
              ? "SHMP production stock has no on-hand value yet."
              : "No SHMP production inventory yet."}
          </p>
        ) : (
          <div className="mt-5 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <CategoryPie slices={byCat} />
            <ul className="space-y-2">
              {byCat.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 font-medium text-ink">
                    {formatMoney(row.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    ) : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            SHMP dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sales, inventory, stores, and factory totals for SHMP.
            {rangeLabel ? <span> Period: {rangeLabel}.</span> : null}
          </p>
        </div>
        <SecondaryButton
          type="button"
          disabled={loading || kpiLoading}
          onClick={reload}
          className="inline-flex items-center gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading || kpiLoading ? "animate-spin" : ""}`}
            strokeWidth={1.75}
          />
          Refresh
        </SecondaryButton>
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}. Factory totals need the SHMP API and an account with{" "}
          <code>environments</code> including <code>shmp</code>.
        </p>
      ) : null}

      <KpiDashboard
        side="shmp"
        showHeader={false}
        loading={kpiLoading}
        onRefresh={reload}
        kpi={kpi}
        kpiError={kpiError}
        onRetryKpi={reload}
        stats={attentionStats}
        statsError={null}
        onRetryStats={reload}
        mulkyaAlerts={mulkyaAlerts}
        mulkyaLoading={mulkyaLoading}
        inventoryValue={stock ? stock.value : null}
        storeCount={storeCount}
        skuCount={stock ? stock.skus : null}
        afterPerformance={today}
        insightExtra={category}
      />
    </div>
  );
}

function DashLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
      {children}
    </h2>
  );
}

function CategoryPie({ slices }: { slices: CategorySlice[] }) {
  const total = slices.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return null;

  const cx = 110;
  const cy = 110;
  const r = 96;
  const paths = slices.reduce<
    Array<CategorySlice & { start: number; end: number; sweep: number }>
  >((acc, slice) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    const sweep = (slice.value / total) * 360;
    acc.push({ ...slice, start, end: start + sweep, sweep });
    return acc;
  }, []);

  return (
    <svg
      viewBox="0 0 220 220"
      className="mx-auto h-52 w-52"
      role="img"
      aria-label="Inventory value by category"
    >
      {paths.length === 1 ? (
        <circle cx={cx} cy={cy} r={r} fill={paths[0].color} />
      ) : (
        paths.map((slice) => (
          <path
            key={slice.key}
            d={describeSlice(cx, cy, r, slice.start, slice.end)}
            fill={slice.color}
          />
        ))
      )}
      <circle cx={cx} cy={cy} r={52} fill="white" />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        className="fill-ink"
        fontSize="12"
        fontWeight="700"
      >
        {slices.length}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="fill-slate-500"
        fontSize="10"
      >
        categories
      </text>
    </svg>
  );
}

function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start[0]} ${start[1]} A ${r} ${r} 0 ${large} 0 ${end[0]} ${end[1]} Z`;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(14,58,50,0.04)] transition hover:border-brand/40 hover:bg-[#faf8f3]"
    >
      <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
    </Link>
  );
}

function formatMoney(n: number) {
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

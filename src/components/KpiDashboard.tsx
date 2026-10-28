"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Car,
  IdCard,
  Package,
  PackageX,
  RefreshCw,
  ShieldCheck,
  Store,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { ExpiryAlertDialog } from "@/components/ExpiryAlertDialog";
import { CompanySwitcher } from "@/components/StlFeatureUi";
import { ErrorState, SecondaryButton } from "@/components/ui";
import type { DashboardStats } from "@/lib/api";
import { monthlySalesHref, salesmanBreakdownHref } from "@/lib/admin-kpi";
import {
  EXPIRY_ALERT_DAYS,
  visaAlertsFromDashboard,
  type ExpiryAlertRow,
} from "@/lib/expiry-window";
import { compactMoney, salesMoney } from "@/lib/sales";
import type { AdminKpiDashboard, CompanyKey } from "@/lib/stl-features-api";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MIX = [
  { key: "salesmen" as const, label: "Sales", color: "bg-ink" },
  { key: "warehouse" as const, label: "Warehouse", color: "bg-brand" },
  { key: "admins" as const, label: "Admin", color: "bg-[#2a6f62]" },
  { key: "supervisors" as const, label: "Supervisors", color: "bg-[#c9840f]" },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function moneyLines(value: number) {
  const compact = compactMoney(value);
  const full = salesMoney(value);
  return { compact, full, abbreviated: compact !== full };
}

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

export function KpiDashboard({
  dubai,
  companyKey,
  onCompanyKey,
  loading,
  onRefresh,
  kpi,
  kpiError,
  onRetryKpi,
  stats,
  statsError,
  onRetryStats,
  mulkyaAlerts,
  mulkyaLoading,
}: {
  dubai: { date: string; time: string };
  companyKey: CompanyKey;
  onCompanyKey: (key: CompanyKey) => void;
  loading: boolean;
  onRefresh: () => void;
  kpi: AdminKpiDashboard | null;
  kpiError: string | null;
  onRetryKpi: () => void;
  stats: Partial<DashboardStats>;
  statsError: string | null;
  onRetryStats: () => void;
  mulkyaAlerts: ExpiryAlertRow[];
  mulkyaLoading: boolean;
}) {
  const [openAlert, setOpenAlert] = useState<"mulkya" | "visa" | null>(null);
  const visaAlerts = useMemo(
    () => visaAlertsFromDashboard(kpi?.visaExpiry),
    [kpi],
  );
  const month = kpi?.monthlySales;
  const monthMax = Math.max(
    1,
    month?.current.total ?? 0,
    month?.previous.total ?? 0,
  );
  const maxProduct = Math.max(
    1,
    ...(kpi?.topProducts ?? []).map((row) => row.revenue),
  );
  const maxSalesman = Math.max(
    1,
    ...(kpi?.salesmanGraph ?? []).map((row) => row.delivered),
  );
  const users = kpi?.users;
  const thisMonth = month ? moneyLines(month.current.total) : null;
  const inventory = kpi ? moneyLines(kpi.inventoryValue) : null;
  const lost = kpi ? moneyLines(kpi.salesLost.totalLost) : null;
  const salesmanHint = kpi?.topSalesman
    ? `${compactMoney(kpi.topSalesman.delivered)}${
        kpi.topSalesman.progress != null
          ? ` · ${kpi.topSalesman.progress}% of target`
          : ""
      }`
    : "No sales this month";
  const monthHref = monthlySalesHref(companyKey);
  const topSalesmanHref = kpi?.topSalesman?.salesId
    ? salesmanBreakdownHref(String(kpi.topSalesman.salesId), companyKey)
    : undefined;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            KPI dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-ink">{dubai.date}</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span className="tabular-nums text-ink">{dubai.time}</span>
            <span className="mx-1.5 text-slate-400">·</span>
            Dubai time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySwitcher
            value={companyKey}
            onChange={(key) => key !== "all" && onCompanyKey(key)}
          />
          <SecondaryButton
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            Refresh
          </SecondaryButton>
        </div>
      </header>

      {kpiError && !kpi ? (
        <ErrorState message={kpiError} onRetry={onRetryKpi} />
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Performance</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpi && thisMonth && month ? (
            <>
              <HeroCard
                label="This month"
                icon={TrendingUp}
                value={thisMonth.compact}
                detail={thisMonth.abbreviated ? thisMonth.full : undefined}
                href={monthHref}
              >
                <p className="mt-3 text-xs text-slate-500">
                  vs {compactMoney(month.previous.total)} last month
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${deltaClass(month.delta)}`}
                >
                  {`${month.delta > 0 ? "+" : ""}${compactMoney(month.delta)}${
                    month.deltaPct != null ? ` · ${formatPct(month.deltaPct)}` : ""
                  }`}
                </p>
              </HeroCard>
              <HeroCard
                label="Inventory value"
                icon={Warehouse}
                value={inventory?.compact ?? "—"}
                detail={inventory?.abbreviated ? inventory.full : undefined}
                href="/admin/inventory"
              />
              <HeroCard
                label="Top salesman"
                icon={Trophy}
                value={
                  kpi.topSalesman?.name || kpi.topSalesman?.email || "—"
                }
                detail={salesmanHint}
                href={topSalesmanHref}
              >
                {kpi.topSalesman?.progress != null ? (
                  <ProgressBar
                    pct={kpi.topSalesman.progress}
                    className="mt-4"
                  />
                ) : null}
              </HeroCard>
              <HeroCard
                label="Sales lost"
                icon={PackageX}
                value={lost?.compact ?? "—"}
                detail={
                  lost?.abbreviated
                    ? `${lost.full} · ${formatCount(kpi.salesLost.lineCount)} lines · ${monthLabel(kpi.salesLost.month, kpi.salesLost.year)}`
                    : `${formatCount(kpi.salesLost.lineCount)} lines · ${monthLabel(kpi.salesLost.month, kpi.salesLost.year)}`
                }
                href="/admin/sales-lost"
                alert={kpi.salesLost.totalLost > 0}
              />
            </>
          ) : (
            <>
              <HeroSkeleton />
              <HeroSkeleton />
              <HeroSkeleton />
              <HeroSkeleton />
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Needs attention</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionCard
            label="Mulkiya expiring"
            icon={Car}
            value={mulkyaLoading ? undefined : mulkyaAlerts.length}
            onOpen={() => setOpenAlert("mulkya")}
          />
          <AttentionCard
            label="Visa expiring"
            icon={IdCard}
            value={kpi ? visaAlerts.length : undefined}
            onOpen={() => setOpenAlert("visa")}
          />
          <AttentionCard
            label="Expired trade licenses"
            icon={AlertTriangle}
            value={stats.expiredTradeLicenses}
            href="/admin/stores?license=expired"
          />
          <AttentionCard
            label="Pending approvals"
            icon={ShieldCheck}
            value={stats.pendingApprovals}
            href="/admin/approvals"
          />
        </div>
      </section>

      <ExpiryAlertDialog
        open={openAlert === "mulkya"}
        onClose={() => setOpenAlert(null)}
        title="Mulkiya expiring"
        subtitle={`Vehicles with mulkiya expiry in ${EXPIRY_ALERT_DAYS} days or less, including already expired.`}
        empty={`No vehicles have mulkiya expiring in the next ${EXPIRY_ALERT_DAYS} days.`}
        rows={mulkyaAlerts}
      />
      <ExpiryAlertDialog
        open={openAlert === "visa"}
        onClose={() => setOpenAlert(null)}
        title="Visa expiring"
        subtitle={`People with visa expiry in ${EXPIRY_ALERT_DAYS} days or less, including already expired.`}
        empty={`No visas are expiring in the next ${EXPIRY_ALERT_DAYS} days.`}
        rows={visaAlerts}
      />

      {statsError ? (
        <ErrorState message={statsError} onRetry={onRetryStats} />
      ) : null}

      <section className="space-y-3">
        <SectionLabel>Operations</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CountCard
            label="Users"
            icon={Users}
            value={users ? formatCount(users.total) : undefined}
            href="/admin/profiles/sales"
          >
            {users ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>{users.salesmen} sales</Chip>
                <Chip>{users.warehouse} warehouse</Chip>
                <Chip>{users.admins} admin</Chip>
                <Chip>{users.supervisors} supervisors</Chip>
              </div>
            ) : null}
          </CountCard>
          <CountCard
            label="Stores"
            icon={Store}
            value={
              stats.totalStores != null
                ? formatCount(stats.totalStores)
                : undefined
            }
            href="/admin/stores"
          />
          <CountCard
            label="Warehouse users"
            icon={UserCog}
            value={
              stats.totalWarehouseUsers != null
                ? formatCount(stats.totalWarehouseUsers)
                : users
                  ? formatCount(users.warehouse)
                  : undefined
            }
            href="/admin/profiles/warehouse"
          />
          <CountCard
            label="Inventory SKUs"
            icon={Package}
            value={
              stats.totalInventory != null
                ? formatCount(stats.totalInventory)
                : undefined
            }
            href="/admin/inventory"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel>Insights</SectionLabel>
        {kpi ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Monthly sales" href={monthHref}>
              {month ? (
                <ul className="mt-5 space-y-4">
                  <CompareBar
                    label={monthLabel(month.current.month, month.current.year)}
                    value={compactMoney(month.current.total)}
                    pct={(month.current.total / monthMax) * 100}
                    current
                  />
                  <CompareBar
                    label={monthLabel(month.previous.month, month.previous.year)}
                    value={compactMoney(month.previous.total)}
                    pct={(month.previous.total / monthMax) * 100}
                  />
                </ul>
              ) : (
                <EmptyNote>No monthly sales yet.</EmptyNote>
              )}
            </Panel>
            <Panel title="User mix">
              {users && users.total > 0 ? (
                <UserMix users={users} />
              ) : (
                <EmptyNote>No users to show.</EmptyNote>
              )}
            </Panel>
            <Panel title="Top products">
              {kpi.topProducts.length === 0 ? (
                <EmptyNote>No product sales this month.</EmptyNote>
              ) : (
                <ol className="mt-4 space-y-3">
                  {kpi.topProducts.slice(0, 10).map((product, index) => (
                    <RankRow
                      key={product.productId}
                      rank={index + 1}
                      label={product.name}
                      hint={`${product.itemCode ? `${product.itemCode} · ` : ""}qty ${formatCount(product.qty)}`}
                      value={compactMoney(product.revenue)}
                      pct={(product.revenue / maxProduct) * 100}
                    />
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Sales by salesman">
              {kpi.salesmanGraph.length === 0 ? (
                <EmptyNote>No salesman totals this month.</EmptyNote>
              ) : (
                <>
                  <ol className="mt-4 space-y-3">
                    {kpi.salesmanGraph.slice(0, 10).map((row, index) => (
                      <RankRow
                        key={row.salesId}
                        rank={index + 1}
                        label={row.name}
                        hint={
                          row.target
                            ? `Target ${compactMoney(row.target)}`
                            : undefined
                        }
                        value={compactMoney(row.delivered)}
                        pct={(row.delivered / maxSalesman) * 100}
                        href={
                          row.salesId
                            ? salesmanBreakdownHref(
                                String(row.salesId),
                                companyKey,
                              )
                            : undefined
                        }
                      />
                    ))}
                  </ol>
                  {kpi.salesmanGraph.length > 10 ? (
                    <p className="mt-4 text-xs text-slate-500">
                      Showing top 10 of {formatCount(kpi.salesmanGraph.length)}
                    </p>
                  ) : null}
                </>
              )}
            </Panel>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
      {children}
    </h2>
  );
}

function HeroCard({
  label,
  icon: Icon,
  value,
  detail,
  href,
  alert,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  detail?: string;
  href?: string;
  alert?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
            alert ? "bg-amber-100 text-amber-800" : "bg-[#f7f5f0] text-ink"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p
        className="mt-4 truncate text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-[1.7rem]"
        title={value}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      ) : null}
      {children}
    </>
  );
  const className = `block h-full rounded-2xl border p-5 shadow-[0_1px_2px_rgba(14,58,50,0.05)] ${
    alert
      ? "border-amber-200 bg-amber-50/80"
      : "border-line bg-white"
  } ${href ? "transition hover:border-brand/40 hover:bg-[#faf8f3]" : ""}`;
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function AttentionCard({
  label,
  icon: Icon,
  value,
  href,
  onOpen,
}: {
  label: string;
  icon: LucideIcon;
  value: number | undefined;
  href?: string;
  onOpen?: () => void;
}) {
  const alert = (value ?? 0) > 0;
  const className = `flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(14,58,50,0.04)] transition hover:border-brand/40 ${
    alert
      ? "border-amber-200 bg-amber-50/80"
      : "border-line bg-white hover:bg-[#faf8f3]"
  }`;
  const body = (
    <>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
          {label}
        </p>
        {value == null ? (
          <span className="mt-1 block h-6 w-10 animate-pulse rounded bg-slate-100" />
        ) : (
          <p
            className={`mt-1 text-xl font-semibold tabular-nums tracking-tight ${
              alert ? "text-amber-900" : "text-ink"
            }`}
          >
            {formatCount(value)}
          </p>
        )}
      </div>
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          alert ? "bg-amber-100 text-amber-800" : "bg-[#f7f5f0] text-slate-500"
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
    </>
  );
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={className}>
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function CountCard({
  label,
  icon: Icon,
  value,
  href,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: string | undefined;
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(14,58,50,0.04)] transition hover:border-brand/40 hover:bg-[#faf8f3]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
          {label}
        </p>
        <Icon className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
      </div>
      {value == null ? (
        <span className="mt-3 block h-8 w-20 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </p>
      )}
      {children}
    </Link>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#f7f5f0] px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(14,58,50,0.04)]">
      {href ? (
        <Link
          href={href}
          className="text-sm font-semibold text-ink hover:text-brand"
        >
          {title}
        </Link>
      ) : (
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      )}
      {children}
    </section>
  );
}

function CompareBar({
  label,
  value,
  pct,
  current,
}: {
  label: string;
  value: string;
  pct: number;
  current?: boolean;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums text-ink">{value}</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full bg-slate-100">
        <div
          className={`h-2.5 rounded-full ${current ? "bg-brand" : "bg-ink/70"}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </li>
  );
}

function UserMix({
  users,
}: {
  users: AdminKpiDashboard["users"];
}) {
  const parts = MIX.map((item) => ({
    ...item,
    n: users[item.key],
  }));
  const total = users.total || 1;
  return (
    <div className="mt-5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {parts.map((part) =>
          part.n > 0 ? (
            <div
              key={part.key}
              className={part.color}
              style={{ width: `${(part.n / total) * 100}%` }}
              title={`${part.label}: ${part.n}`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2.5">
        {parts.map((part) => (
          <li
            key={part.key}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`h-2 w-2 rounded-full ${part.color}`} />
              {part.label}
            </span>
            <span className="font-medium tabular-nums text-ink">
              {formatCount(part.n)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankRow({
  rank,
  label,
  hint,
  value,
  pct,
  href,
}: {
  rank: number;
  label: string;
  hint?: string;
  value: string;
  pct: number;
  href?: string;
}) {
  const body = (
    <>
      <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-slate-400">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{label}</p>
            {hint ? (
              <p className="truncate text-[11px] text-slate-500">{hint}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
            {value}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
          <div
            className="h-1.5 rounded-full bg-ink/75"
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
    </>
  );
  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="-mx-1 flex items-start gap-3 rounded-lg px-1 py-0.5 hover:bg-[#faf8f3]"
        >
          {body}
        </Link>
      </li>
    );
  }
  return <li className="flex items-start gap-3">{body}</li>;
}

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 ${className}`}>
      <div
        className="h-1.5 rounded-full bg-brand"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm text-slate-500">{children}</p>;
}

function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
      <div className="mt-5 h-8 w-36 animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-3 w-28 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-5 space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

function deltaClass(delta: number) {
  if (delta > 0) return "text-emerald-700";
  if (delta < 0) return "text-rose-700";
  return "text-slate-500";
}

function formatPct(pct: number) {
  const rounded = Math.abs(pct) >= 100 ? Math.round(pct) : Number(pct.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

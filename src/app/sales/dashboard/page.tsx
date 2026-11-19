"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  FileWarning,
  Package,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import { CategorySalesPie } from "@/components/CategorySalesPie";
import {
  EXPIRY_ALERT_DAYS,
  expiryUrgencyLabel,
} from "@/lib/expiry-window";
import { compactMoney, salesMoney } from "@/lib/sales";
import {
  getSalesAccountDashboard,
  type CompanyKey,
  type SalesAccountDashboard,
  type SalesAccountPerformanceBlock,
} from "@/lib/stl-features-api";

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

export default function SalesDashboardPage() {
  const { user } = useAuth();
  const [companyKey, setCompanyKey] = useState<CompanyKey | "all">("all");
  const [data, setData] = useState<SalesAccountDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSalesAccountDashboard(user.id, {
        companyKey: companyKey === "all" ? undefined : companyKey,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.now) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [data?.now, load]);

  const attendancePct =
    data && data.monthAttendance.days > 0
      ? Math.round(
          (data.monthAttendance.present / data.monthAttendance.days) * 100,
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your sales performance, attendance, and store alerts (Dubai time)."
        actions={
          <div className="flex gap-2">
            {(["all", "stl", "shmp"] as const).map((key) => (
              <SecondaryButton
                key={key}
                type="button"
                onClick={() => setCompanyKey(key)}
                className={
                  companyKey === key ? "!bg-brand !text-ink !border-brand" : ""
                }
              >
                {key === "all" ? "All" : key.toUpperCase()}
              </SecondaryButton>
            ))}
          </div>
        }
      />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data ? (
        <div className="space-y-7">
          <div className="overflow-hidden rounded-2xl border border-[#0e3a32]/15 bg-gradient-to-br from-[#0e3a32] via-[#145044] to-[#1a5c4e] p-5 text-white shadow-[0_8px_24px_rgba(14,58,50,0.18)] sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.16em] text-white/70 uppercase">
                  Dubai time
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {data.now.date}
                </p>
                <p className="mt-1 text-lg font-medium text-[#f7a51c]">
                  {data.now.time}
                  <span className="ml-2 text-sm font-normal text-white/60">
                    {data.now.timezone}
                  </span>
                </p>
                {user?.name ? (
                  <p className="mt-3 text-sm text-white/75">
                    Welcome back, {user.name.split(" ")[0]}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <QuickLink href="/sales/attendance" icon={Clock3}>
                  Attendance
                </QuickLink>
                <QuickLink href="/sales/leave" icon={CalendarDays}>
                  Leave
                </QuickLink>
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <SectionLabel>Performance</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Sales this month"
                icon={TrendingUp}
                tone="brand"
                value={salesMoney(data.monthlySales.current.total)}
                hint={`vs ${compactMoney(data.monthlySales.previous.total)} in ${monthLabel(
                  data.monthlySales.previous.month,
                  data.monthlySales.previous.year,
                )}`}
              >
                <DeltaBadge
                  delta={data.monthlySales.delta}
                  deltaPct={data.monthlySales.deltaPct}
                />
              </MetricCard>

              {companyKey === "all" ? (
                <TargetCard
                  label="Target progress"
                  block={{
                    delivered:
                      data.performance.combined?.delivered ??
                      data.performance.totalDelivered,
                    target: data.performance.combined?.target ?? null,
                    progress: data.performance.combined?.progress ?? null,
                  }}
                  hint={`STL ${salesMoney(data.performance.stl.delivered)} · SHMP ${salesMoney(
                    data.performance.shmp.delivered,
                  )}`}
                />
              ) : companyKey === "stl" ? (
                <TargetCard label="STL target" block={data.performance.stl} />
              ) : (
                <TargetCard label="SHMP target" block={data.performance.shmp} />
              )}

              <MetricCard
                label="Attendance this month"
                icon={Clock3}
                tone="teal"
                value={`${data.monthAttendance.present} / ${data.monthAttendance.days}`}
                hint={`Leave ${data.monthAttendance.leave} · Absent ${data.monthAttendance.absent}`}
              >
                <div className="mt-3 space-y-2">
                  {attendancePct != null ? (
                    <ProgressBar pct={attendancePct} tone="teal" />
                  ) : null}
                  <p className="text-xs font-medium text-[#2a6f62] capitalize">
                    Today · {data.attendance.status.replace(/_/g, " ")}
                  </p>
                </div>
              </MetricCard>
            </div>

            {companyKey === "all" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TargetCard label="STL target" block={data.performance.stl} />
                <TargetCard label="SHMP target" block={data.performance.shmp} />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionLabel>Highlights</SectionLabel>
            <div className="grid gap-4 lg:grid-cols-2">
              <HighlightCard
                label="Top-selling item"
                icon={Package}
                tone="brand"
              >
                {data.topProduct ? (
                  <>
                    <p className="text-lg font-semibold text-ink">
                      {data.topProduct.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {data.topProduct.itemCode || "—"} · qty{" "}
                      {data.topProduct.qty}
                    </p>
                    <p className="mt-3 inline-flex rounded-full bg-brand/20 px-3 py-1 text-sm font-semibold text-ink">
                      {salesMoney(data.topProduct.revenue)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No sales this month</p>
                )}
              </HighlightCard>

              <HighlightCard
                label="Top-purchasing customer"
                icon={Store}
                tone="teal"
              >
                {data.topCustomer ? (
                  <>
                    <p className="text-lg font-semibold text-ink">
                      {data.topCustomer.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {data.topCustomer.address || "—"}
                    </p>
                    <p className="mt-3 inline-flex rounded-full bg-[#0e3a32]/10 px-3 py-1 text-sm font-semibold text-ink">
                      {salesMoney(data.topCustomer.value)} ·{" "}
                      {data.topCustomer.orders} orders
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No sales this month</p>
                )}
              </HighlightCard>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(14,58,50,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Category-wise sales
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Grouped by parent category for this month.
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e3a32]/10 text-ink">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
              <CategorySalesPie rows={data.categoryDistribution} />
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>Needs attention</SectionLabel>
            <div
              className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(14,58,50,0.05)] ${
                data.tradeLicenses.count > 0
                  ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/70"
                  : "border-line bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      data.tradeLicenses.count > 0
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[#f7f5f0] text-slate-500"
                    }`}
                  >
                    <FileWarning className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">
                      Trade licenses expired or expiring
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Assigned stores whose trade license expires in{" "}
                      {EXPIRY_ALERT_DAYS} days or less, including already
                      expired.
                    </p>
                  </div>
                </div>
                <p
                  className={`text-3xl font-semibold tabular-nums tracking-tight ${
                    data.tradeLicenses.count > 0
                      ? "text-amber-900"
                      : "text-ink"
                  }`}
                >
                  {data.tradeLicenses.count}
                </p>
              </div>
              {data.tradeLicenses.stores.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No trade licenses are due right now.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-amber-200/70">
                  {data.tradeLicenses.stores.map((store) => (
                    <li
                      key={store.id}
                      className="flex items-start justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{store.name}</p>
                        <p className="mt-0.5 text-slate-600">
                          {store.tradeLicenseExpiry || "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                          store.daysRemaining <= 0
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {expiryUrgencyLabel(store.daysRemaining)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
      <h2 className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
        {children}
      </h2>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
    >
      <Icon className="h-4 w-4 text-[#f7a51c]" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

type MetricTone = "brand" | "teal" | "ink";

const TONE_STYLES: Record<
  MetricTone,
  { card: string; icon: string; bar: string }
> = {
  brand: {
    card: "border-brand/30 bg-gradient-to-br from-white to-[#fff8eb]",
    icon: "bg-brand/25 text-ink",
    bar: "bg-brand",
  },
  teal: {
    card: "border-[#2a6f62]/25 bg-gradient-to-br from-white to-[#eef6f3]",
    icon: "bg-[#0e3a32]/10 text-[#0e3a32]",
    bar: "bg-[#2a6f62]",
  },
  ink: {
    card: "border-[#0e3a32]/15 bg-gradient-to-br from-white to-[#f3f7f6]",
    icon: "bg-[#0e3a32]/10 text-ink",
    bar: "bg-ink",
  },
};

function MetricCard({
  label,
  icon: Icon,
  tone,
  value,
  hint,
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone: MetricTone;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(14,58,50,0.05)] ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${styles.icon}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}

function TargetCard({
  label,
  block,
  hint,
}: {
  label: string;
  block: Pick<
    SalesAccountPerformanceBlock,
    "delivered" | "target" | "progress"
  >;
  hint?: string;
}) {
  const progress = block.progress;
  return (
    <MetricCard
      label={label}
      icon={Target}
      tone="ink"
      value={
        block.target != null
          ? `${salesMoney(block.delivered)} / ${salesMoney(block.target)}`
          : salesMoney(block.delivered)
      }
      hint={
        hint ||
        (block.target != null
          ? progress != null
            ? `${progress}% of target`
            : "Target set"
          : "No target set")
      }
    >
      {progress != null ? (
        <div className="mt-3 space-y-1.5">
          <ProgressBar pct={progress} tone="brand" />
          <p className="text-xs font-medium text-[#0e3a32]">
            {progress}% complete
          </p>
        </div>
      ) : null}
    </MetricCard>
  );
}

function HighlightCard({
  label,
  icon: Icon,
  tone,
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone: MetricTone;
  children: ReactNode;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_1px_2px_rgba(14,58,50,0.05)] ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {label}
        </p>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${styles.icon}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DeltaBadge({
  delta,
  deltaPct,
}: {
  delta: number;
  deltaPct: number | null;
}) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = down ? TrendingDown : TrendingUp;
  const tone = up
    ? "bg-emerald-100 text-emerald-800"
    : down
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {`${up ? "+" : ""}${compactMoney(delta)}`}
      {deltaPct != null ? ` · ${formatPct(deltaPct)}` : ""}
    </span>
  );
}

function ProgressBar({
  pct,
  tone = "brand",
  className = "",
}: {
  pct: number;
  tone?: MetricTone;
  className?: string;
}) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-black/5 ${className}`}
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${TONE_STYLES[tone].bar}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

function formatPct(pct: number) {
  const rounded =
    Math.abs(pct) >= 100 ? Math.round(pct) : Number(pct.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

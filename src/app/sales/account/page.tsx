"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import { SalesAccountTabs } from "@/components/StlFeatureUi";
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

export default function SalesAccountPage() {
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
      setError(e instanceof Error ? e.message : "Failed to load account");
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

  return (
    <div>
      <PageHeader
        title="Sales account"
        subtitle="Your sales dashboard — this month's performance, attendance, and store alerts (Dubai time)."
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

      <SalesAccountTabs />

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data ? (
        <div className="space-y-6">
          <Card className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Current date & time
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                {data.now.date}{" "}
                <span className="text-lg font-medium text-slate-600">
                  {data.now.time}
                </span>
              </p>
              <p className="text-xs text-slate-500">{data.now.timezone}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/sales/attendance"
                className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-[#f7f5f0]"
              >
                Attendance
              </Link>
              <Link
                href="/sales/leave"
                className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-[#f7f5f0]"
              >
                Leave
              </Link>
            </div>
          </Card>

          <section className="space-y-3">
            <SectionLabel>Performance</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Metric
                label="Sales this month"
                value={salesMoney(data.monthlySales.current.total)}
                hint={`vs ${compactMoney(data.monthlySales.previous.total)} in ${monthLabel(
                  data.monthlySales.previous.month,
                  data.monthlySales.previous.year,
                )}`}
              >
                <p
                  className={`mt-1 text-xs font-medium ${deltaClass(
                    data.monthlySales.delta,
                  )}`}
                >
                  {`${data.monthlySales.delta > 0 ? "+" : ""}${compactMoney(
                    data.monthlySales.delta,
                  )}${
                    data.monthlySales.deltaPct != null
                      ? ` · ${formatPct(data.monthlySales.deltaPct)}`
                      : ""
                  }`}
                </p>
              </Metric>

              {companyKey === "all" ? (
                <TargetMetric
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
                <TargetMetric label="STL target" block={data.performance.stl} />
              ) : (
                <TargetMetric
                  label="SHMP target"
                  block={data.performance.shmp}
                />
              )}

              <Metric
                label="Attendance this month"
                value={`${data.monthAttendance.present} / ${data.monthAttendance.days}`}
                hint={`Leave ${data.monthAttendance.leave} · Absent ${data.monthAttendance.absent}`}
              >
                <p className="mt-1 text-xs text-slate-500 capitalize">
                  Today: {data.attendance.status.replace(/_/g, " ")}
                </p>
              </Metric>
            </div>

            {companyKey === "all" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TargetMetric label="STL target" block={data.performance.stl} />
                <TargetMetric
                  label="SHMP target"
                  block={data.performance.shmp}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionLabel>Leave balances</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric
                label="Annual leave left"
                value={`${data.leave.remaining.annual} / ${data.leave.entitlements.annual}`}
                hint={`Pending ${data.leave.pending.annual}d`}
              />
              <Metric
                label="Sick leave left"
                value={`${data.leave.remaining.sick} / ${data.leave.entitlements.sick}`}
                hint={`Pending ${data.leave.pending.sick}d`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionLabel>Highlights</SectionLabel>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="text-sm font-semibold text-ink">
                  Top-selling item
                </h2>
                {data.topProduct ? (
                  <div className="mt-3">
                    <p className="text-lg font-semibold text-ink">
                      {data.topProduct.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {data.topProduct.itemCode || "—"} · qty{" "}
                      {data.topProduct.qty}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {salesMoney(data.topProduct.revenue)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No sales this month
                  </p>
                )}
              </Card>
              <Card>
                <h2 className="text-sm font-semibold text-ink">
                  Top-purchasing customer
                </h2>
                {data.topCustomer ? (
                  <div className="mt-3">
                    <p className="text-lg font-semibold text-ink">
                      {data.topCustomer.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {data.topCustomer.address || "—"}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {salesMoney(data.topCustomer.value)} ·{" "}
                      {data.topCustomer.orders} orders
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No sales this month
                  </p>
                )}
              </Card>
            </div>

            <Card>
              <h2 className="text-sm font-semibold text-ink">
                Category-wise sales
              </h2>
              {data.categoryDistribution.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No category data</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {data.categoryDistribution.map((row) => (
                    <li
                      key={row.categoryId || row.name}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span>{row.name}</span>
                      <span className="font-medium">
                        {salesMoney(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section className="space-y-3">
            <SectionLabel>Needs attention</SectionLabel>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Trade licenses expired or expiring
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Assigned stores whose trade license expires in{" "}
                    {EXPIRY_ALERT_DAYS} days or less, including already expired.
                  </p>
                </div>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
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
                <ul className="mt-4 divide-y divide-line">
                  {data.tradeLicenses.stores.map((store) => (
                    <li
                      key={store.id}
                      className="flex items-start justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{store.name}</p>
                        <p className="mt-0.5 text-slate-500">
                          {store.tradeLicenseExpiry || "—"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          store.daysRemaining <= 0
                            ? "bg-red-50 text-red-800"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {expiryUrgencyLabel(store.daysRemaining)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
      {children}
    </h2>
  );
}

function Metric({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {children}
    </Card>
  );
}

function TargetMetric({
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
  return (
    <Metric
      label={label}
      value={
        block.target != null
          ? `${salesMoney(block.delivered)} / ${salesMoney(block.target)}`
          : salesMoney(block.delivered)
      }
      hint={
        hint ||
        (block.target != null
          ? block.progress != null
            ? `${block.progress}% of target`
            : "Target set"
          : "No target set")
      }
    >
      {block.progress != null ? (
        <ProgressBar pct={block.progress} className="mt-3" />
      ) : null}
    </Metric>
  );
}

function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand"
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

function deltaClass(delta: number) {
  if (delta > 0) return "text-[#2a6f62]";
  if (delta < 0) return "text-red-700";
  return "text-slate-500";
}

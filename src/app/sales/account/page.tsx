"use client";

import { useCallback, useEffect, useState } from "react";
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
import { salesMoney } from "@/lib/sales";
import {
  getSalesAccountDashboard,
  type CompanyKey,
  type SalesAccountDashboard,
} from "@/lib/stl-features-api";

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
        subtitle="Attendance, leave balances, and monthly sales highlights (Dubai time)."
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
        <div className="space-y-4">
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Attendance today"
              value={data.attendance.status.replace(/_/g, " ")}
            />
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
            <Metric
              label="Sales this month"
              value={salesMoney(data.performance.totalDelivered)}
              hint={
                companyKey === "stl"
                  ? `Target ${data.performance.stl.target ?? "—"}`
                  : companyKey === "shmp"
                    ? `Target ${data.performance.shmp.target ?? "—"}`
                    : `STL ${salesMoney(data.performance.stl.delivered)} · SHMP ${salesMoney(data.performance.shmp.delivered)}`
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-semibold text-ink">Top-selling item</h2>
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
                <p className="mt-3 text-sm text-slate-500">No sales this month</p>
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
                <p className="mt-3 text-sm text-slate-500">No sales this month</p>
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
                    <span className="font-medium">{salesMoney(row.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold capitalize text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

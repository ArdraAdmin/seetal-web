"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CompanySwitcher, StatCard } from "@/components/StlFeatureUi";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import { salesmanBreakdownHref } from "@/lib/admin-kpi";
import { compactMoney, salesMoney } from "@/lib/sales";
import {
  getAdminKpiDashboard,
  type AdminKpiDashboard,
  type CompanyKey,
} from "@/lib/stl-features-api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthTitle(month: number, year: number) {
  return `${MONTHS[month - 1] ?? month} ${year}`;
}

export default function AdminMonthlySalesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialCompany = searchParams.get("company") === "shmp" ? "shmp" : "stl";
  const [companyKey, setCompanyKey] = useState<CompanyKey>(initialCompany);
  const [kpi, setKpi] = useState<AdminKpiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setKpi(await getAdminKpiDashboard(user.id, { companyKey }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load monthly sales");
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const month = kpi?.monthlySales;
  const salesmanMax = useMemo(
    () => Math.max(1, ...(kpi?.salesmanGraph ?? []).map((row) => row.delivered)),
    [kpi],
  );

  return (
    <div>
      <PageHeader
        title="This month’s sales"
        subtitle="Confirmed delivered value for the selected company, with last month for comparison."
        actions={
          <>
            <Link
              href="/admin"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
            >
              Back to KPIs
            </Link>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </>
        }
      />

      <div className="mb-4">
        <CompanySwitcher
          value={companyKey}
          onChange={(key) => key !== "all" && setCompanyKey(key)}
        />
      </div>

      {loading && !kpi ? (
        <LoadingState label="Loading monthly sales…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : kpi && month ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label={monthTitle(month.current.month, month.current.year)}
              value={salesMoney(month.current.total)}
              hint="This month"
            />
            <StatCard
              label={monthTitle(month.previous.month, month.previous.year)}
              value={salesMoney(month.previous.total)}
              hint="Last month"
            />
            <StatCard
              label="Change"
              value={`${month.delta > 0 ? "+" : ""}${salesMoney(month.delta)}`}
              hint={
                month.deltaPct != null
                  ? `${month.deltaPct > 0 ? "+" : ""}${month.deltaPct}% vs last month`
                  : "No last-month baseline"
              }
            />
          </div>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Sales by salesman</h2>
            {kpi.salesmanGraph.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No salesman totals this month.
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {kpi.salesmanGraph.map((row, index) => {
                  const href = row.salesId
                    ? salesmanBreakdownHref(String(row.salesId), companyKey)
                    : undefined;
                  const body = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">
                          {index + 1}. {row.name}
                        </p>
                        {row.target ? (
                          <p className="text-[11px] text-slate-500">
                            Target {compactMoney(row.target)}
                          </p>
                        ) : null}
                      </div>
                      <div className="w-40 shrink-0 text-right">
                        <p className="text-sm font-medium tabular-nums text-ink">
                          {salesMoney(row.delivered)}
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-ink/75"
                            style={{
                              width: `${Math.max(2, Math.min(100, (row.delivered / salesmanMax) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                  return (
                    <li key={row.salesId || `${row.name}-${index}`}>
                      {href ? (
                        <Link
                          href={href}
                          className="flex items-center justify-between gap-3 py-2.5 hover:bg-[#faf8f3]"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-3 py-2.5">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Top products</h2>
            {kpi.topProducts.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No product sales this month.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">Item code</th>
                      <th className="py-2 pr-3 text-right">Qty</th>
                      <th className="py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {kpi.topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td className="py-2 pr-3 font-medium">{product.name}</td>
                        <td className="py-2 pr-3">{product.itemCode || "-"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {product.qty}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">
                          {salesMoney(product.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <EmptyState title="No monthly sales yet" />
      )}
    </div>
  );
}

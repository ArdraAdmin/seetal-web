"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Package,
  ShieldCheck,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { loadDashboardStats, type DashboardStats } from "@/lib/api";
import { salesMoney } from "@/lib/sales";
import { useAuth } from "@/components/AuthProvider";
import {
  CompanySwitcher,
  StatCard,
  useDubaiNow,
} from "@/components/StlFeatureUi";
import {
  Card,
  ErrorState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import {
  getAdminKpiDashboard,
  type AdminKpiDashboard,
  type CompanyKey,
} from "@/lib/stl-features-api";

type Metric = {
  key: keyof DashboardStats;
  label: string;
  href: string;
  icon: typeof Users;
  alert?: boolean;
};

const METRICS: Metric[] = [
  {
    key: "totalUsers",
    label: "Total users",
    href: "/admin/profiles/sales",
    icon: Users,
  },
  {
    key: "totalStores",
    label: "Total stores",
    href: "/admin/stores",
    icon: Store,
  },
  {
    key: "totalSalesman",
    label: "Total salesman",
    href: "/admin/profiles/sales",
    icon: Users,
  },
  {
    key: "totalWarehouseUsers",
    label: "Warehouse users",
    href: "/admin/profiles/warehouse",
    icon: UserCog,
  },
  {
    key: "expiredTradeLicenses",
    label: "Expired trade licenses",
    href: "/admin/stores?license=expired",
    icon: AlertTriangle,
    alert: true,
  },
  {
    key: "totalInventory",
    label: "Total inventory",
    href: "/admin/inventory",
    icon: Package,
  },
  {
    key: "pendingApprovals",
    label: "Pending approvals",
    href: "/admin/approvals",
    icon: ShieldCheck,
    alert: true,
  },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function MetricCard({
  metric,
  value,
}: {
  metric: Metric;
  value: number | undefined;
}) {
  const Icon = metric.icon;
  const highlight = Boolean(metric.alert && (value ?? 0) > 0);
  return (
    <Link
      href={metric.href}
      className={`rounded-xl border bg-white p-5 hover:bg-[#f7f5f0] ${
        highlight ? "border-brand" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{metric.label}</p>
        <Icon
          className={`h-4 w-4 ${highlight ? "text-brand" : "text-slate-400"}`}
          strokeWidth={1.75}
        />
      </div>
      {value == null ? (
        <span className="mt-3 block h-8 w-24 animate-pulse rounded bg-slate-100" />
      ) : (
        <p className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {formatCount(value)}
        </p>
      )}
    </Link>
  );
}

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

function Bar({ pct, label, value }: { pct: number; label: string; value: string }) {
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 font-medium">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-brand"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </li>
  );
}

function KpiSection({ stats }: { stats: Partial<DashboardStats> }) {
  const { user } = useAuth();
  const dubai = useDubaiNow();
  const [companyKey, setCompanyKey] = useState<CompanyKey>("stl");
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
      setError(e instanceof Error ? e.message : "Failed to load KPIs");
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxSalesman = Math.max(1, ...(kpi?.salesmanGraph ?? []).map((r) => r.delivered));
  const maxProduct = Math.max(1, ...(kpi?.topProducts ?? []).map((r) => r.revenue));
  const m = kpi?.monthlySales;
  const monthMax = Math.max(1, m?.current.total ?? 0, m?.previous.total ?? 0);

  return (
    <section className="space-y-4">
      <Card className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Dubai date & time
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {dubai.date}{" "}
            <span className="text-lg font-medium text-slate-600">
              {dubai.time}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySwitcher value={companyKey} onChange={(k) => k !== "all" && setCompanyKey(k)} />
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        </div>
      </Card>

      {error && !kpi ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi ? (
          <>
            <StatCard
              label="Top salesman"
              value={kpi.topSalesman?.name || kpi.topSalesman?.email || "—"}
              hint={
                kpi.topSalesman
                  ? `${salesMoney(kpi.topSalesman.delivered)}${
                      kpi.topSalesman.progress != null
                        ? ` · ${kpi.topSalesman.progress}% of target`
                        : ""
                    }`
                  : "No sales this month"
              }
            />
            <StatCard
              label="Inventory value"
              value={salesMoney(kpi.inventoryValue)}
              href="/admin/inventory"
            />
            <StatCard
              label="Sales lost"
              value={salesMoney(kpi.salesLost.totalLost)}
              hint={`${kpi.salesLost.lineCount} lines · ${MONTHS[kpi.salesLost.month - 1] ?? ""} ${kpi.salesLost.year} — view details`}
              href="/admin/sales-lost"
              alert={kpi.salesLost.totalLost > 0}
            />
            <StatCard
              label="Users"
              value={String(kpi.users.total)}
              hint={`${kpi.users.salesmen} sales · ${kpi.users.warehouse} warehouse · ${kpi.users.admins} admin · ${kpi.users.supervisors} supervisors`}
              href="/admin/profiles/sales"
            />
            <StatCard
              label="Mulkiya expiring"
              value={String(kpi.mulkiyaExpiry.count)}
              href="/admin/fleet"
              alert={kpi.mulkiyaExpiry.count > 0}
            />
            <StatCard
              label="Visa expiring"
              value={String(kpi.visaExpiry.count)}
              href="/admin/hr"
              alert={kpi.visaExpiry.count > 0}
            />
            <StatCard
              label="This month"
              value={m ? salesMoney(m.current.total) : "—"}
              hint={
                m
                  ? `vs ${salesMoney(m.previous.total)} last month (${m.delta >= 0 ? "+" : ""}${salesMoney(m.delta)}${m.deltaPct != null ? `, ${m.deltaPct}%` : ""})`
                  : undefined
              }
            />
          </>
        ) : null}
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            value={stats[metric.key]}
          />
        ))}
      </div>

      {kpi ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-semibold text-ink">
                Monthly sales vs previous
              </h2>
              {m ? (
                <ul className="mt-3 space-y-3">
                  <Bar
                    label={`${MONTHS[m.current.month - 1]} ${m.current.year}`}
                    value={salesMoney(m.current.total)}
                    pct={(m.current.total / monthMax) * 100}
                  />
                  <Bar
                    label={`${MONTHS[m.previous.month - 1]} ${m.previous.year}`}
                    value={salesMoney(m.previous.total)}
                    pct={(m.previous.total / monthMax) * 100}
                  />
                </ul>
              ) : null}
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-ink">User distribution</h2>
              <ul className="mt-3 space-y-3">
                {(
                  [
                    ["Salesmen", kpi.users.salesmen],
                    ["Warehouse", kpi.users.warehouse],
                    ["Admins", kpi.users.admins],
                    ["Supervisors", kpi.users.supervisors],
                  ] as const
                ).map(([label, n]) => (
                  <Bar
                    key={label}
                    label={label}
                    value={String(n)}
                    pct={kpi.users.total ? (n / kpi.users.total) * 100 : 0}
                  />
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-semibold text-ink">Top 10 products</h2>
              {kpi.topProducts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No data</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {kpi.topProducts.slice(0, 10).map((p) => (
                    <Bar
                      key={p.productId}
                      label={`${p.name}${p.itemCode ? ` (${p.itemCode})` : ""} · qty ${p.qty}`}
                      value={salesMoney(p.revenue)}
                      pct={(p.revenue / maxProduct) * 100}
                    />
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-ink">Sales by salesman</h2>
              {kpi.salesmanGraph.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No data</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {kpi.salesmanGraph.map((r) => (
                    <Bar
                      key={r.salesId}
                      label={`${r.name}${r.target ? ` · target ${salesMoney(r.target)}` : ""}`}
                      value={salesMoney(r.delivered)}
                      pct={(r.delivered / maxSalesman) * 100}
                    />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Partial<DashboardStats>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStats({});
    setError(null);
    try {
      await loadDashboardStats((partial) => {
        setStats((current) => ({ ...current, ...partial }));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="KPI dashboard"
        subtitle="Company KPIs (Dubai time) and current totals across users, stores, and inventory."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      <KpiSection stats={stats} />
    </div>
  );
}

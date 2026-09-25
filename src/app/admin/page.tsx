"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Package,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { loadDashboardStats, type DashboardStats } from "@/lib/api";
import {
  ErrorState,
  PageHeader,
} from "@/components/ui";

type Metric = {
  key: keyof DashboardStats;
  label: string;
  href: string;
  icon: typeof Users;
  alert?: boolean;
  format?: "count" | "money";
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
    href: "/admin/stores",
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

const PAYMENT_METRICS: Metric[] = [
  {
    key: "paymentReceived",
    label: "Payment received",
    href: "/admin/payments",
    icon: Banknote,
    format: "money",
  },
  {
    key: "receivable",
    label: "Receivable",
    href: "/admin/payments",
    icon: Wallet,
    format: "money",
  },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
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
          {metric.format === "money" ? formatMoney(value) : formatCount(value)}
        </p>
      )}
    </Link>
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
        title="Dashboard"
        subtitle="Current totals across users, stores, inventory, and payments."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {METRICS.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                value={stats[metric.key]}
              />
            ))}
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink uppercase">
              Payments
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {PAYMENT_METRICS.map((metric) => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  value={stats[metric.key]}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getSalesPerformance, type SalesPerformance } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(value) || 0;
  return `AED ${n.toFixed(2)}`;
}

function CompanyCard({
  title,
  block,
}: {
  title: string;
  block: SalesPerformance["stl"];
}) {
  const pct =
    block.targetSet && typeof block.progress === "number"
      ? Math.min(100, Math.max(0, block.progress))
      : null;
  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Delivered</dt>
          <dd className="font-medium">{money(block.delivered)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500">Target</dt>
          <dd className="font-medium">
            {block.targetSet ? money(block.target) : "Not set"}
          </dd>
        </div>
      </dl>
      {pct != null ? (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{pct.toFixed(1)}% of target</p>
        </div>
      ) : null}
    </Card>
  );
}

export default function SalesPerformancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<SalesPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getSalesPerformance(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load performance");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Performance"
        subtitle="This month’s delivered amount (orders marked Done) vs STL and SHMP targets."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />
      {loading ? (
        <LoadingState label="Loading performance…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !data ? (
        <EmptyState title="No performance data" />
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {data.month}/{data.year}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {money(data.totalDelivered)}
            </p>
            <p className="mt-1 text-sm text-slate-500">Total delivered this month</p>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <CompanyCard title="STL" block={data.stl} />
            <CompanyCard title="SHMP" block={data.shmp} />
          </div>
        </div>
      )}
    </div>
  );
}

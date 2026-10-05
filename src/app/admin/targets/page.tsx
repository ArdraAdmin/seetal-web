"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAdminPerformance,
  setAdminSalesTarget,
  type PerformanceCompanyBlock,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(value) || 0;
  return `AED ${n.toFixed(2)}`;
}

type SalesmanRow = {
  sales: { _id: string; name?: string; email?: string };
  totalDelivered: number;
  stl: PerformanceCompanyBlock;
  shmp: PerformanceCompanyBlock;
};

function CompanyBlock({
  title,
  block,
  salesId,
  onSet,
  busy,
}: {
  title: string;
  block: PerformanceCompanyBlock;
  salesId: string;
  onSet: (salesId: string, companyId: string, amount: number) => Promise<void>;
  busy: boolean;
}) {
  const [amount, setAmount] = useState("");
  const pct =
    block.targetSet && typeof block.progress === "number"
      ? Math.min(100, Math.max(0, block.progress))
      : null;

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">{title}</h4>
        {block.targetSet ? (
          <span className="text-xs text-slate-500">Locked</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm">Delivered: {money(block.delivered)}</p>
      <p className="text-sm">
        Target: {block.targetSet ? money(block.target) : "Not set"}
      </p>
      {pct != null ? (
        <div className="mt-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{pct.toFixed(1)}%</p>
        </div>
      ) : null}
      {!block.targetSet && block.companyId ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!Number.isFinite(n) || n < 0) return;
            void onSet(salesId, String(block.companyId), n).then(() =>
              setAmount(""),
            );
          }}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-32 rounded-lg border border-line px-2 py-1 text-sm"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={busy}>
            Set target
          </PrimaryButton>
        </form>
      ) : null}
    </div>
  );
}

export default function AdminTargetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SalesmanRow[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminPerformance();
      setRows((data.salesmen || []) as SalesmanRow[]);
      setYear(data.year);
      setMonth(data.month);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSet(salesId: string, companyId: string, amount: number) {
    setBusy(true);
    try {
      await setAdminSalesTarget({
        salesId,
        companyId,
        amount,
        userId: user?.id,
      });
      toast("Target set", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to set target", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sales targets"
        subtitle={
          month && year
            ? `Achieved vs target for ${month}/${year}. Targets can be set once and cannot be edited.`
            : "Achieved vs target for the current month."
        }
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      {loading ? (
        <LoadingState label="Loading sales targets…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No salesmen found" />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.sales._id} className="p-4">
              <div className="mb-3">
                <p className="font-semibold">{row.sales.name || "Salesman"}</p>
                {row.sales.email ? (
                  <p className="text-sm text-slate-500">{row.sales.email}</p>
                ) : null}
                <p className="mt-1 text-sm font-medium">
                  Total delivered: {money(row.totalDelivered)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <CompanyBlock
                  title="STL"
                  block={row.stl}
                  salesId={row.sales._id}
                  onSet={onSet}
                  busy={busy}
                />
                <CompanyBlock
                  title="SHMP"
                  block={row.shmp}
                  salesId={row.sales._id}
                  onSet={onSet}
                  busy={busy}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

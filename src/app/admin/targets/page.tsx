"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  TextField,
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
  onSave,
  busy,
}: {
  title: string;
  block: PerformanceCompanyBlock;
  salesId: string;
  onSave: (
    salesId: string,
    companyId: string,
    amount: number,
    isEdit: boolean,
  ) => Promise<void>;
  busy: boolean;
}) {
  const isEdit = block.targetSet === true;
  const [amount, setAmount] = useState(
    isEdit && block.target != null ? String(block.target) : "",
  );
  const pct =
    block.targetSet && typeof block.progress === "number"
      ? Math.min(100, Math.max(0, block.progress))
      : null;

  useEffect(() => {
    setAmount(isEdit && block.target != null ? String(block.target) : "");
  }, [block.target, isEdit]);

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">{title}</h4>
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
      {block.companyId ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!Number.isFinite(n) || n < 0) return;
            void onSave(salesId, String(block.companyId), n, isEdit);
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
            {isEdit ? "Update target" : "Set target"}
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
  const [query, setQuery] = useState("");

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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (row.sales.name || "").toLowerCase();
      const email = (row.sales.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [query, rows]);

  async function onSave(
    salesId: string,
    companyId: string,
    amount: number,
    isEdit: boolean,
  ) {
    setBusy(true);
    try {
      await setAdminSalesTarget({
        salesId,
        companyId,
        amount,
        userId: user?.id,
      });
      toast(isEdit ? "Target updated" : "Target set", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save target", "error");
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
            ? `Achieved vs target for ${month}/${year}. Targets can be set or edited anytime.`
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
        <>
          <Card className="mb-4 p-4">
            <TextField
              label="Search sales people"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
            />
            <p className="mt-2 text-sm text-slate-500">
              {filteredRows.length} sales person
              {filteredRows.length === 1 ? "" : "s"}
            </p>
          </Card>

          {filteredRows.length === 0 ? (
            <EmptyState title="No matching sales people" />
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => (
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
                      onSave={onSave}
                      busy={busy}
                    />
                    <CompanyBlock
                      title="SHMP"
                      block={row.shmp}
                      salesId={row.sales._id}
                      onSave={onSave}
                      busy={busy}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

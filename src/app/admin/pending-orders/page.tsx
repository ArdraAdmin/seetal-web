"use client";

import { useCallback, useEffect, useState } from "react";
import { exportTempOrders, getPendingOrders } from "@/lib/api";
import type { PendingOrder } from "@/lib/types";
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

function normalizeOrders(data: unknown): PendingOrder[] {
  if (Array.isArray(data)) return data as PendingOrder[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.orders)) return o.orders as PendingOrder[];
    if (Array.isArray(o.data)) return o.data as PendingOrder[];
    if (Array.isArray(o.results)) return o.results as PendingOrder[];
  }
  return [];
}

export default function PendingOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const load = useCallback(
    async (p: number) => {
      if (!user?.id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getPendingOrders(user.id, p, 0);
        setOrders(normalizeOrders(data));
        setPage(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onExport() {
    if (!user?.id || selected.size === 0) {
      toast("Select at least one order", "info");
      return;
    }
    setExporting(true);
    try {
      await exportTempOrders([...selected], user.id);
      toast("Export requested", "success");
      setSelected(new Set());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Pending orders"
        subtitle="Temporary warehouse orders awaiting processing."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
            >
              Prev
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={loading || orders.length === 0}
              onClick={() => void load(page + 1)}
            >
              Next
            </SecondaryButton>
            <PrimaryButton
              type="button"
              disabled={exporting || selected.size === 0}
              onClick={() => void onExport()}
            >
              {exporting ? "Exporting…" : `Export (${selected.size})`}
            </PrimaryButton>
          </div>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(page)} />
      ) : orders.length === 0 ? (
        <EmptyState title="No pending orders" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const id = o._id;
            const invoice =
              o.tempOrderInvoiceNo || o.invoiceNumber || id.slice(-6);
            const storeName =
              o.storeName ||
              (typeof o.store === "object" ? o.store?.storeName || o.store?.name : "") ||
              "Unknown store";
            const amount = o.totalAmount ?? o.amount ?? 0;
            return (
              <Card
                key={id}
                className="flex flex-wrap items-start gap-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    Invoice {invoice}
                  </p>
                  <p className="text-sm text-slate-600">{storeName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Amount: ₹{amount}
                    {o.createdAt || o.date
                      ? ` · ${String(o.createdAt || o.date).slice(0, 10)}`
                      : ""}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

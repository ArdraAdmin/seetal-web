"use client";

import { useCallback, useEffect, useState } from "react";
import { getGrvOrders } from "@/lib/api";
import type { GrvOrder } from "@/lib/types";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

export default function GrvPage() {
  const [orders, setOrders] = useState<GrvOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GrvOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGrvOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GRV orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Goods return vouchers"
        subtitle="Returned goods and credit documentation."
        actions={
          <SecondaryButton type="button" onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : orders.length === 0 ? (
        <EmptyState title="No GRV orders" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {orders.map((o) => {
              const storeName =
                o.storeName ||
                (typeof o.store === "object"
                  ? o.store?.storeName || o.store?.name
                  : "") ||
                "Unknown store";
              return (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => setSelected(o)}
                  className={`w-full rounded-xl border bg-white p-4 text-left ${
                    selected?._id === o._id
                      ? "border-brand"
                      : "border-line hover:border-brand/50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">
                    {o.invoiceNumber || o._id.slice(-8)}
                  </p>
                  <p className="text-sm text-slate-600">{storeName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ₹{o.totalAmount ?? 0}
                    {o.createdAt || o.date
                      ? ` · ${String(o.createdAt || o.date).slice(0, 10)}`
                      : ""}
                    {Array.isArray(o.productDetails)
                      ? ` · ${o.productDetails.length} items`
                      : ""}
                  </p>
                </button>
              );
            })}
          </div>

          <Card>
            {selected ? (
              <div>
                <h2 className="text-base font-semibold text-ink">
                  Voucher detail
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invoice {selected.invoiceNumber || selected._id}
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Amount</dt>
                    <dd className="font-medium">₹{selected.totalAmount ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Items</dt>
                    <dd className="font-medium">
                      {Array.isArray(selected.productDetails)
                        ? selected.productDetails.length
                        : 0}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-slate-500">
                  Edit flows will come in a later pass if needed. List + open
                  detail is Phase 1 scope.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Select a GRV order to view details.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

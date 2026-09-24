"use client";

import { useCallback, useEffect, useState } from "react";
import { getGrvOrders } from "@/lib/api";
import type { GrvOrder } from "@/lib/types";
import {
  formatInvoiceDate,
  invoiceNumberOf,
  invoiceStoreName,
  invoiceTotal,
  orderGrvAmount,
} from "@/lib/invoice";
import { salesMoney } from "@/lib/sales";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

export default function WarehouseGrvPage() {
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
        subtitle="Recorded returns. Editing GRV is available to admin."
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
            {orders.map((order, index) => (
              <button
                key={order._id || `grv-${index}`}
                type="button"
                onClick={() => setSelected(order)}
                className={`w-full rounded-xl border bg-white p-4 text-left ${
                  selected?._id === order._id
                    ? "border-brand"
                    : "border-line hover:border-brand/50"
                }`}
              >
                <p className="font-semibold text-slate-900">
                  {invoiceNumberOf(order)}
                </p>
                <p className="text-sm text-slate-600">{invoiceStoreName(order)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {salesMoney(invoiceTotal(order))}
                  {order.createdAt || order.date
                    ? ` · ${formatInvoiceDate(order.createdAt || order.date)}`
                    : ""}
                </p>
              </button>
            ))}
          </div>
          <Card>
            {selected ? (
              <div>
                <h2 className="text-base font-semibold text-ink">Voucher detail</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Invoice {invoiceNumberOf(selected)}
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Amount</dt>
                    <dd className="font-medium">{salesMoney(invoiceTotal(selected))}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">GRV</dt>
                    <dd className="font-medium">{salesMoney(orderGrvAmount(selected))}</dd>
                  </div>
                </dl>
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

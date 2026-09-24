"use client";

import { useCallback, useEffect, useState } from "react";
import { getSalesConfirmedOrders } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { approvalInvoice, approvalMoney, approvalPayable, approvalStoreName } from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

function invoiceOf(order: ApprovalOrder) {
  if (typeof order.invoiceNumber === "string" && order.invoiceNumber.trim()) {
    return order.invoiceNumber;
  }
  return approvalInvoice(order);
}

function storeOf(order: ApprovalOrder) {
  if (typeof order.store === "string" && order.store.trim()) return order.store;
  return approvalStoreName(order);
}

export default function SalesConfirmedOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await getSalesConfirmedOrders(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load confirmed orders");
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
        title="Confirmed orders"
        subtitle="Orders that have already been confirmed."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />
      {loading ? (
        <LoadingState label="Loading confirmed orders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : orders.length === 0 ? (
        <EmptyState title="No confirmed orders" />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <article
              key={order._id}
              className="rounded-2xl border border-line bg-white p-4"
            >
              <p className="text-xs font-medium text-slate-500">{invoiceOf(order)}</p>
              <p className="mt-1 font-semibold text-slate-900">{storeOf(order)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {approvalMoney(approvalPayable(order))}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSalesPendingOrders } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import {
  approvalInvoice,
  approvalMoney,
  approvalPayable,
  approvalRejectNote,
  approvalStoreName,
  salesQueueStatus,
  salesQueueStatusLabel,
} from "@/lib/approval";
import { statusClass } from "@/components/ApprovalViews";
import { useAuth } from "@/components/AuthProvider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

export default function SalesPendingOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await getSalesPendingOrders(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pending orders");
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
        title="Pending orders"
        subtitle="Orders waiting in the warehouse queue, including any that admin rejected."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />
      {loading ? (
        <LoadingState label="Loading pending orders…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : orders.length === 0 ? (
        <EmptyState title="No pending orders" />
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const status = salesQueueStatus(order);
            const note = approvalRejectNote(order);
            return (
              <Link
                key={order._id}
                href={`/sales/pending/${order._id}`}
                className="block rounded-2xl border border-line bg-white p-4 hover:bg-[#f7f5f0]"
              >
                <p className="text-xs font-medium text-slate-500">
                  {approvalInvoice(order)}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {approvalStoreName(order)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {approvalMoney(approvalPayable(order))}
                </p>
                <p
                  className={`mt-2 text-sm font-semibold ${statusClass(status === "none" ? "" : status)}`}
                >
                  {salesQueueStatusLabel(order)}
                </p>
                {status === "rejected" && note ? (
                  <p className="mt-1 text-sm text-slate-600">Admin note: {note}</p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

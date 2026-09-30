"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSalesConfirmedOrders, placeApprovedOrder } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import {
  apiMessage,
  approvalInvoice,
  approvalMoney,
  approvalOrderDate,
  approvalPayable,
  approvalStoreName,
  canPlaceApprovedOrder,
} from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

function invoiceOf(order: ApprovalOrder) {
  if (typeof order.invoiceNumber === "string" && order.invoiceNumber.trim()) {
    return order.invoiceNumber;
  }
  return approvalInvoice(order);
}

function storeOf(order: ApprovalOrder) {
  if (typeof order.store === "string" && order.store.trim() && order.store !== "null") {
    return order.store;
  }
  return approvalStoreName(order);
}

export default function SalesConfirmedOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);

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

  async function onPlace(order: ApprovalOrder) {
    if (!user?.id) return;
    setPlacingId(order._id);
    try {
      const result = await placeApprovedOrder(order._id, user.id);
      toast(
        apiMessage(
          result,
          "Order placed. The order form will be emailed shortly.",
        ),
        "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not place order", "error");
    } finally {
      setPlacingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Confirmed orders"
        subtitle="Admin-approved orders can be placed here. Placing sends them to the warehouse and emails the order form."
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const canPlace = canPlaceApprovedOrder(order);
            const date = approvalOrderDate(order);
            const placing = placingId === order._id;
            return (
              <article
                key={order._id}
                className="flex h-full flex-col rounded-2xl border border-line bg-white p-4"
              >
                <Link
                  href={`/sales/confirmed/${order._id}`}
                  className="block min-w-0"
                >
                  <p className="truncate text-xs font-medium text-slate-500">
                    {invoiceOf(order)}
                  </p>
                  {date ? (
                    <p className="mt-0.5 text-xs text-slate-500">{date}</p>
                  ) : null}
                  <p className="mt-1 truncate font-semibold text-slate-900">
                    {storeOf(order)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {approvalMoney(approvalPayable(order))}
                  </p>
                  {canPlace ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">
                      Approved by admin
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Confirmed
                    </p>
                  )}
                </Link>
                {canPlace ? (
                  <div className="mt-auto pt-3">
                    <PrimaryButton
                      type="button"
                      disabled={placing}
                      onClick={() => void onPlace(order)}
                    >
                      {placing ? "Placing…" : "Place order"}
                    </PrimaryButton>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

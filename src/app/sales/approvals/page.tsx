"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSalesApprovals, placeApprovedOrder } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { apiMessage } from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import { ApprovalSummary } from "@/components/ApprovalViews";
import { useToast } from "@/components/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

export default function SalesApprovalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await getSalesApprovals(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPlace(order: ApprovalOrder) {
    if (!user?.id) return;
    setBusyId(order._id);
    try {
      const result = await placeApprovedOrder(order._id, user.id);
      toast(apiMessage(result, "Order placed"), "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not place order", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Orders with a discount or edited payable wait here until admin reviews them."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      {loading ? (
        <LoadingState label="Loading approvals…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders waiting for approval"
          description="Orders with a discount or an edited payable amount appear here after they are sent from the sales cart."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = String(order.approvalStatus || "pending");
            const busy = busyId === order._id;
            return (
              <div
                key={order._id}
                className="rounded-xl border border-line bg-white p-4"
              >
                <ApprovalSummary order={order} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/sales/approvals/${order._id}`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    View
                  </Link>
                  {status === "approved" ? (
                    <PrimaryButton
                      type="button"
                      disabled={busy}
                      onClick={() => void onPlace(order)}
                    >
                      {busy ? "Placing…" : "Place order"}
                    </PrimaryButton>
                  ) : null}
                  {status === "rejected" ? (
                    <Link
                      href={`/sales/approvals/${order._id}/edit`}
                      className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
                    >
                      Edit and resend
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSalesOrder, placeApprovedOrder } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { apiMessage, salesQueueStatus } from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import { ApprovalDetails } from "@/components/ApprovalViews";
import { useToast } from "@/components/Toast";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
} from "@/components/ui";

export default function SalesPendingOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const match = await getSalesOrder(user.id, params.id);
      setOrder(match);
      if (!match) setError("Order not found");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPlace() {
    if (!order || !user?.id) return;
    setBusy(true);
    try {
      const result = await placeApprovedOrder(order._id, user.id);
      toast(apiMessage(result, "Order placed"), "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not place order", "error");
    } finally {
      setBusy(false);
    }
  }

  const status = order ? salesQueueStatus(order) : "none";

  return (
    <div>
      <PageHeader
        title="Order details"
        subtitle="If admin rejected this order, the note is shown here. Edit the same order to send it again."
        actions={
          <Link
            href="/sales/pending"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back
          </Link>
        }
      />

      {loading ? (
        <LoadingState label="Loading order…" />
      ) : error || !order ? (
        <ErrorState message={error || "Order not found"} onRetry={() => void load()} />
      ) : (
        <>
          <ApprovalDetails order={order} />
          <div className="mt-5 flex flex-wrap gap-2">
            {status === "approved" ? (
              <PrimaryButton type="button" disabled={busy} onClick={() => void onPlace()}>
                {busy ? "Placing…" : "Place order"}
              </PrimaryButton>
            ) : null}
            {status === "rejected" ? (
              <Link
                href={`/sales/pending/${order._id}/edit`}
                className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
              >
                Edit and resend
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

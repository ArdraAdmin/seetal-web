"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSalesApprovals, placeApprovedOrder } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { apiMessage } from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import { ApprovalDetails } from "@/components/ApprovalViews";
import { useToast } from "@/components/Toast";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
} from "@/components/ui";

export default function SalesApprovalDetailsPage() {
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
      const orders = await getSalesApprovals(user.id);
      const match = orders.find((item) => item._id === params.id) || null;
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

  const status = String(order?.approvalStatus || "");

  return (
    <div>
      <PageHeader
        title="Order details"
        subtitle="If admin approved this order, you can place it. If they rejected it, edit and send it again."
        actions={
          <Link
            href="/sales/approvals"
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
                href={`/sales/approvals/${order._id}/edit`}
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { decideApproval, getApprovalQueue } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { ApprovalDetails } from "@/components/ApprovalViews";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

export default function AdminApprovalDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orders = await getApprovalQueue();
      const match = orders.find((item) => item._id === params.id) || null;
      setOrder(match);
      if (!match) setError("Order not found in the approval queue");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => order?.approvalStatus === "pending",
    [order],
  );

  async function onApprove() {
    if (!order) return;
    setBusy(true);
    try {
      await decideApproval(order._id, true);
      toast("Order approved", "success");
      router.push("/admin/approvals");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approve failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!order) return;
    const note = rejectNote.trim();
    if (!note) {
      toast("Please add a rejection note", "info");
      return;
    }
    setBusy(true);
    try {
      await decideApproval(order._id, false, note);
      toast("Order rejected", "success");
      router.push("/admin/approvals");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reject failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Order details"
        subtitle="Review discount or payable changes before warehouse can see this order."
        actions={
          <Link
            href="/admin/approvals"
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
          {pending ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <SecondaryButton
                type="button"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </SecondaryButton>
              <PrimaryButton type="button" disabled={busy} onClick={() => void onApprove()}>
                {busy ? "Saving…" : "Approve"}
              </PrimaryButton>
            </div>
          ) : null}
          {rejectOpen ? (
            <Card className="mt-4">
              <p className="text-sm font-semibold text-black">Reject order</p>
              <p className="mt-1 text-sm text-slate-500">
                Add a note so the salesman knows what to change.
              </p>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                placeholder="Add a note for the salesman"
              />
              <div className="mt-3 flex gap-2">
                <SecondaryButton
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectOpen(false)}
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="button" disabled={busy} onClick={() => void onReject()}>
                  {busy ? "Saving…" : "Reject"}
                </PrimaryButton>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

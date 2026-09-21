"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { decideApproval, getApprovalQueue } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import { ApprovalSummary } from "@/components/ApprovalViews";
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

export default function AdminApprovalsPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApprovalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalOrder | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getApprovalQueue());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(order: ApprovalOrder) {
    setBusyId(order._id);
    try {
      await decideApproval(order._id, true);
      toast("Order approved", "success");
      setRejecting(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Approve failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject() {
    if (!rejecting) return;
    const note = rejectNote.trim();
    if (!note) {
      toast("Please add a rejection note", "info");
      return;
    }
    setBusyId(rejecting._id);
    try {
      await decideApproval(rejecting._id, false, note);
      toast("Order rejected", "success");
      setRejecting(null);
      setRejectNote("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reject failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Discount and payable changes from salesmen wait here for review."
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
        <EmptyState title="No orders to review" />
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
                <Link href={`/admin/approvals/${order._id}`} className="block">
                  <ApprovalSummary order={order} showSalesman />
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/approvals/${order._id}`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    View
                  </Link>
                  {status === "pending" ? (
                    <>
                      <SecondaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejecting(order);
                          setRejectNote("");
                        }}
                      >
                        Reject
                      </SecondaryButton>
                      <PrimaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => void onApprove(order)}
                      >
                        {busy ? "Saving…" : "Approve"}
                      </PrimaryButton>
                    </>
                  ) : null}
                </div>
                {rejecting?._id === order._id ? (
                  <Card className="mt-3">
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
                        onClick={() => setRejecting(null)}
                      >
                        Cancel
                      </SecondaryButton>
                      <PrimaryButton
                        type="button"
                        disabled={busy}
                        onClick={() => void onReject()}
                      >
                        {busy ? "Saving…" : "Reject"}
                      </PrimaryButton>
                    </div>
                  </Card>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

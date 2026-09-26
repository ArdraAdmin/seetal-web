"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSalesOrder, resubmitApprovalOrder } from "@/lib/api";
import type { ApprovalOrder } from "@/lib/types";
import {
  apiMessage,
  computedPayable,
  resubmitTempOrderPayload,
} from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import { ApprovalDetails } from "@/components/ApprovalViews";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export default function SalesPendingOrderEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [payable, setPayable] = useState("");
  const [payableTouched, setPayableTouched] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const match = await getSalesOrder(user.id, params.id);
      setOrder(match);
      if (!match) {
        setError("Order not found");
        return;
      }
      const nextDiscount = Number(match.discount) || 0;
      setDiscount(String(nextDiscount));
      setNote(match.note && match.note !== "No note" ? match.note : "");
      const computed = computedPayable(
        Number(match.totalCost) || 0,
        nextDiscount,
        Boolean(match.isVat),
      );
      setPayable(
        String(
          match.payableAmount != null ? match.payableAmount : computed.toFixed(2),
        ),
      );
      setPayableTouched(Boolean(match.payableEdited));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const discountValue = Number(discount) || 0;
  const computed = useMemo(() => {
    if (!order) return 0;
    return computedPayable(
      Number(order.totalCost) || 0,
      discountValue,
      Boolean(order.isVat),
    );
  }, [order, discountValue]);

  const payableValue = Number(payable) || 0;
  const payableEdited =
    payableTouched && Math.abs(payableValue - computed) > 0.009;
  const needsApproval = discountValue > 0 || payableEdited;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!order || !user?.id) return;
    setSaving(true);
    try {
      const result = await resubmitApprovalOrder(
        resubmitTempOrderPayload(order, {
          salesId: user.id,
          discount: discountValue,
          payableAmount: payableValue,
          payableEdited,
          needsApproval,
          note,
        }),
      );
      toast(
        apiMessage(
          result,
          needsApproval ? "Order sent for admin approval" : "Order updated",
        ),
        "success",
      );
      router.push("/sales/pending");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Resend failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit and resend"
        subtitle="This updates the same order. It does not create a new invoice."
        actions={
          <Link
            href={`/sales/pending/${params.id}`}
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
        <form onSubmit={onSubmit} className="space-y-4">
          <ApprovalDetails order={order} />
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Discount (%)"
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => {
                  const next = e.target.value;
                  setDiscount(next);
                  if (!payableTouched) {
                    setPayable(
                      computedPayable(
                        Number(order.totalCost) || 0,
                        Number(next) || 0,
                        Boolean(order.isVat),
                      ).toFixed(2),
                    );
                  }
                }}
              />
              <TextField
                label="Payable (AED)"
                type="number"
                step="0.01"
                value={payable}
                onChange={(e) => {
                  setPayableTouched(true);
                  setPayable(e.target.value);
                }}
              />
            </div>
            <label className="mt-3 block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>
            {needsApproval ? (
              <p className="mt-3 text-sm text-slate-600">
                This order will be sent to admin for approval because a discount
                was entered or the payable amount was edited.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Clear the discount and restore the original payable to place
                without approval. Otherwise admin must approve first.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving
                  ? "Sending…"
                  : needsApproval
                    ? "Send for approval"
                    : "Update order"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => router.push("/sales/pending")}
              >
                Cancel
              </SecondaryButton>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}

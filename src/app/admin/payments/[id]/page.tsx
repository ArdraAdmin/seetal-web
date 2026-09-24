"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  createPayment,
  createPdc,
  getConfirmedInvoice,
  getInvoiceLines,
  getPayments,
  getPdcs,
} from "@/lib/api";
import type { GrvOrder, PaymentRecord, PdcRecord } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  collectableAmount,
  formatInvoiceDate,
  invoiceDateOf,
  invoiceNumberOf,
  invoiceStoreName,
  invoiceTotal,
  isGrvPayment,
  isPdcDue,
  isPdcPending,
  latestPdc,
  PAYMENT_CURRENCY,
  paymentOrderId,
  pdcOrderId,
  receivedAmount,
  remainingAmount,
  orderGrvAmount,
} from "@/lib/invoice";
import { readChequeDateFromImage } from "@/lib/ocr-date";
import { salesMoney } from "@/lib/sales";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

export default function AdminPaymentInvoicePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<GrvOrder | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pdcs, setPdcs] = useState<PdcRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdcOpen, setPdcOpen] = useState(false);
  const [pdcFile, setPdcFile] = useState<File | null>(null);
  const [pdcPreview, setPdcPreview] = useState("");
  const [pdcDate, setPdcDate] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const [invoice, paymentList, pdcList] = await Promise.all([
        getConfirmedInvoice(user.id, params.id),
        getPayments(user.id),
        getPdcs(user.id),
      ]);
      if (!invoice) {
        setError("Invoice not found");
        setOrder(null);
        return;
      }
      const { lines } = await getInvoiceLines(user.id, invoice);
      setOrder({ ...invoice, productDetails: lines });
      setPayments(paymentList.filter((payment) => paymentOrderId(payment) === params.id));
      setPdcs(pdcList.filter((pdc) => pdcOrderId(pdc) === params.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pdc = latestPdc(pdcs);
  const remaining = order ? remainingAmount(order, payments) : 0;
  const received = receivedAmount(payments);
  const collectable = order ? collectableAmount(order) : 0;
  const grvLine = payments.find(isGrvPayment);
  const pendingPdc = isPdcPending(pdc);
  const duePdc = isPdcDue(pdc) && remaining > 0.009;
  const canComplete = remaining > 0.009 && !pdc;
  const canClear = duePdc;

  const remarks = useMemo(() => {
    return [...payments].sort((a, b) => {
      const aTime = new Date(a.date || a.createdAt as string || 0).getTime();
      const bTime = new Date(b.date || b.createdAt as string || 0).getTime();
      return aTime - bTime;
    });
  }, [payments]);

  async function markPaid(note: string) {
    if (!user?.id || !order) return;
    if (remaining <= 0) {
      toast("This invoice is already fully paid", "info");
      return;
    }
    setBusy(true);
    try {
      await createPayment({
        paymentMode: "Cash",
        date: new Date().toISOString(),
        orderId: order._id,
        currency: PAYMENT_CURRENCY,
        note,
        amountPaid: remaining,
      });
      toast("Payment recorded", "success");
      setPdcOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not record payment", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    setPdcFile(file);
    setOcrText("");
    setPdcDate("");
    if (pdcPreview) URL.revokeObjectURL(pdcPreview);
    if (!file) {
      setPdcPreview("");
      return;
    }
    setPdcPreview(URL.createObjectURL(file));
    setOcrBusy(true);
    try {
      const result = await readChequeDateFromImage(file);
      setOcrText(result.text);
      if (result.date) {
        const iso = `${result.date.getFullYear()}-${String(result.date.getMonth() + 1).padStart(2, "0")}-${String(result.date.getDate()).padStart(2, "0")}`;
        setPdcDate(iso);
      } else {
        toast("Could not read a date from this image. Enter the cheque date.", "info");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read the cheque image", "error");
    } finally {
      setOcrBusy(false);
    }
  }

  async function savePdc() {
    if (!order) return;
    if (!pdcFile) {
      toast("Upload the cheque image", "info");
      return;
    }
    if (!pdcDate) {
      toast("A cheque date is required", "info");
      return;
    }
    setBusy(true);
    try {
      await createPdc({
        orderId: order._id,
        givenDate: new Date().toISOString(),
        chequeDate: new Date(`${pdcDate}T00:00:00`).toISOString(),
        amount: remaining,
      });
      toast("PDC saved", "success");
      setPdcOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save PDC", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={order ? invoiceNumberOf(order) : "Invoice"}
        subtitle="Mark the remaining collectable amount as received, or attach a post-dated cheque."
        actions={
          <Link
            href="/admin/payments"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back
          </Link>
        }
      />

      {loading ? (
        <LoadingState label="Loading invoice…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !order ? (
        <ErrorState message="Invoice not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="font-semibold text-black">{invoiceStoreName(order)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatInvoiceDate(invoiceDateOf(order))}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Invoice amount" value={salesMoney(invoiceTotal(order))} />
              {orderGrvAmount(order) > 0 ? (
                <Row
                  label={grvLine?.note || `GRV ${salesMoney(orderGrvAmount(order))} will not be collected`}
                  value={`− ${salesMoney(orderGrvAmount(order))}`}
                />
              ) : null}
              <Row label="Collectable" value={salesMoney(collectable)} />
              <Row label="Received" value={salesMoney(received)} />
              <Row label="Balance" value={salesMoney(remaining)} emphasize />
            </dl>
            {pdc ? (
              <p className="mt-3 text-sm text-slate-600">
                PDC on file for {salesMoney(Number(pdc.amount) || remaining)}, cheque date{" "}
                {formatInvoiceDate(pdc.chequeDate)}
                {pendingPdc ? ". Clear payment will appear on that date." : "."}
              </p>
            ) : null}
          </Card>

          <Card>
            <p className="mb-3 text-sm font-semibold text-black">Remarks</p>
            {remarks.length === 0 ? (
              <p className="text-sm text-slate-500">No payment remarks yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {remarks.map((payment) => (
                  <li key={payment._id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm text-black">{payment.note || payment.paymentMode}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatInvoiceDate(payment.date)}
                      {isGrvPayment(payment)
                        ? " · GRV (not collectable)"
                        : ` · ${salesMoney(Number(payment.amountPaid) || 0)} received`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-wrap gap-2">
            {canComplete ? (
              <PrimaryButton
                type="button"
                disabled={busy}
                onClick={() => void markPaid("Payment completed")}
              >
                {busy ? "Saving…" : "Mark as completed"}
              </PrimaryButton>
            ) : null}
            {canClear ? (
              <PrimaryButton
                type="button"
                disabled={busy}
                onClick={() => void markPaid("PDC cleared")}
              >
                {busy ? "Saving…" : "Clear payment"}
              </PrimaryButton>
            ) : null}
            {canComplete ? (
              <SecondaryButton
                type="button"
                disabled={busy}
                onClick={() => setPdcOpen((open) => !open)}
              >
                PDC
              </SecondaryButton>
            ) : null}
          </div>

          {pdcOpen && canComplete ? (
            <Card>
              <p className="text-sm font-semibold text-black">Post-dated cheque</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload the cheque image. The cheque date is read from the picture. Clear payment stays hidden until that date.
              </p>
              <input
                type="file"
                accept="image/*"
                className="mt-3 block w-full text-sm"
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />
              {pdcPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pdcPreview}
                  alt="Cheque preview"
                  className="mt-3 max-h-56 rounded-lg border border-line object-contain"
                />
              ) : null}
              {ocrBusy ? (
                <p className="mt-3 text-sm text-slate-500">Reading cheque date…</p>
              ) : null}
              <label className="mt-3 block space-y-1.5">
                <span className="text-[13px] font-medium text-slate-700">
                  Cheque date
                </span>
                <input
                  type="date"
                  value={pdcDate}
                  onChange={(e) => setPdcDate(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </label>
              {ocrText ? (
                <p className="mt-2 text-xs text-slate-500">
                  Text read from image: {ocrText.slice(0, 180)}
                  {ocrText.length > 180 ? "…" : ""}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <SecondaryButton type="button" disabled={busy} onClick={() => setPdcOpen(false)}>
                  Cancel
                </SecondaryButton>
                <PrimaryButton type="button" disabled={busy || ocrBusy} onClick={() => void savePdc()}>
                  {busy ? "Saving…" : "Save PDC"}
                </PrimaryButton>
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={emphasize ? "font-semibold text-black" : "text-slate-500"}>{label}</dt>
      <dd className={emphasize ? "font-semibold text-ink" : "font-medium text-ink"}>{value}</dd>
    </div>
  );
}

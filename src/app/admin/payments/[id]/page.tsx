"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  clearInvoicePayment,
  createPdcWithImage,
  getPaymentInvoice,
  readChequeDate,
  type PaymentInvoice,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  formatInvoiceDate,
  isPdcPending,
  paymentActions,
} from "@/lib/invoice";
import { roundMoney, salesMoney } from "@/lib/sales";
import type { PdcRecord } from "@/lib/types";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

function chequeRecord(invoice: PaymentInvoice | null): PdcRecord | null {
  if (!invoice || invoice.paymentStatus !== "pdc" || !invoice.chequeDate) return null;
  return {
    _id: invoice.pdcId || invoice.id,
    chequeDate: invoice.chequeDate,
    amount: invoice.collectableAmount,
  };
}

export default function AdminPaymentInvoicePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdcOpen, setPdcOpen] = useState(false);
  const [pdcFile, setPdcFile] = useState<File | null>(null);
  const [pdcPreview, setPdcPreview] = useState("");
  const [pdcDate, setPdcDate] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      setInvoice(await getPaymentInvoice(user.id, params.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [params.id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const pdc = chequeRecord(invoice);
  const remaining = invoice
    ? roundMoney(Math.max(0, (Number(invoice.collectableAmount) || 0) - (Number(invoice.amountPaid) || 0)))
    : 0;
  const { canComplete, canClear } = paymentActions({ remaining, pdc });
  const pendingPdc = isPdcPending(pdc);

  async function markPaid() {
    if (!user?.id || !invoice) return;
    if (remaining <= 0) {
      toast("This invoice is already fully paid", "info");
      return;
    }
    setBusy(true);
    try {
      await clearInvoicePayment({
        userId: user.id,
        paymentId: invoice.paymentId,
        invoiceId: invoice.id,
        source: invoice.source,
      });
      toast(canClear ? "Payment cleared" : "Payment recorded", "success");
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
    setPdcDate("");
    if (pdcPreview) URL.revokeObjectURL(pdcPreview);
    if (!file) {
      setPdcPreview("");
      return;
    }
    setPdcPreview(URL.createObjectURL(file));
    if (!user?.id) return;
    setOcrBusy(true);
    try {
      const result = await readChequeDate(user.id, file);
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
    if (!user?.id || !invoice) return;
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
      await createPdcWithImage({
        userId: user.id,
        invoiceId: invoice.id,
        source: invoice.source,
        amount: remaining,
        chequeDate: pdcDate,
        file: pdcFile,
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
        title={invoice?.invoiceNumber || "Invoice"}
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
      ) : !invoice ? (
        <ErrorState message="Invoice not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="font-semibold text-black">{invoice.storeName || "Store"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatInvoiceDate(invoice.date)}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Invoice amount" value={salesMoney(invoice.totalCost)} />
              {invoice.grvAmount > 0 ? (
                <Row
                  label={invoice.grvRemark || `GRV ${salesMoney(invoice.grvAmount)} will not be collected`}
                  value={`− ${salesMoney(invoice.grvAmount)}`}
                />
              ) : null}
              <Row label="Collectable" value={salesMoney(invoice.collectableAmount)} />
              <Row label="Received" value={salesMoney(invoice.amountPaid)} />
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

          {invoice.grvRemark ? (
            <Card>
              <p className="mb-2 text-sm font-semibold text-black">Remarks</p>
              <p className="text-sm text-black">{invoice.grvRemark}</p>
              <p className="mt-0.5 text-xs text-slate-500">GRV (not collectable)</p>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canComplete ? (
              <PrimaryButton type="button" disabled={busy} onClick={() => void markPaid()}>
                {busy ? "Saving…" : "Mark as completed"}
              </PrimaryButton>
            ) : null}
            {canClear ? (
              <PrimaryButton type="button" disabled={busy} onClick={() => void markPaid()}>
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
                Upload the cheque image. OpenAI reads the cheque date. Clear payment stays hidden until that date.
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

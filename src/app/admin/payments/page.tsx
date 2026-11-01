"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  exportPayments,
  exportPendingPayments,
  getPaymentInvoices,
  type PaymentInvoice,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  exportRangeBounds,
  formatInvoiceDate,
  isPdcPending,
} from "@/lib/invoice";
import { roundMoney, salesMoney } from "@/lib/sales";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import type { PdcRecord } from "@/lib/types";

type PaymentsTab = "receivable" | "received";
type RangeKey = 7 | 15 | 30 | null;

const RANGES: { id: RangeKey; label: string }[] = [
  { id: 7, label: "Last 7 days" },
  { id: 15, label: "Last 15 days" },
  { id: 30, label: "Last 30 days" },
  { id: null, label: "All" },
];

function chequeRecord(invoice: PaymentInvoice): PdcRecord | null {
  if (invoice.paymentStatus !== "pdc" || !invoice.chequeDate) return null;
  return {
    _id: invoice.pdcId || invoice.id,
    chequeDate: invoice.chequeDate,
    amount: invoice.collectableAmount,
  };
}

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [receivableTotal, setReceivableTotal] = useState(0);
  const [receivedTotal, setReceivedTotal] = useState(0);
  const [tab, setTab] = useState<PaymentsTab>("receivable");
  const [range, setRange] = useState<RangeKey>(7);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPaymentInvoices(user.id, range);
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setReceivableTotal(Number(data.receivables) || 0);
      setReceivedTotal(Number(data.received) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [range, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    return invoices.map((invoice) => ({
      invoice,
      remaining: roundMoney(
        Math.max(0, (Number(invoice.collectableAmount) || 0) - (Number(invoice.amountPaid) || 0)),
      ),
    }));
  }, [invoices]);

  const receivableRows = rows.filter((row) => row.invoice.paymentStatus !== "cleared");
  const receivedRows = rows.filter((row) => row.invoice.paymentStatus === "cleared");
  const visible = tab === "receivable" ? receivableRows : receivedRows;
  const rangeLabel = RANGES.find((item) => item.id === range)?.label || "All";

  async function onExport() {
    if (!user?.id) return;
    const pending = tab === "receivable";
    const kind = pending ? "receivable invoices" : "received payments";
    if (
      !confirm(
        `Export ${kind} (${rangeLabel}) to Excel and email it to noreply@shrseetal.com?`,
      )
    ) {
      return;
    }
    setExporting(true);
    try {
      const { startDate, endDate } = exportRangeBounds(range);
      if (pending) {
        await exportPendingPayments(user.id, startDate, endDate);
      } else {
        await exportPayments(user.id, startDate, endDate);
      }
      toast("An email will be sent shortly", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Open an invoice to mark it completed or attach a post-dated cheque."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={loading || exporting}
              onClick={() => void onExport()}
            >
              {exporting ? "Exporting…" : "Export"}
            </SecondaryButton>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-slate-500">Receivables</p>
          <p className="mt-1 text-xl font-semibold text-ink">{salesMoney(receivableTotal)}</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-slate-500">Received</p>
          <p className="mt-1 text-xl font-semibold text-ink">{salesMoney(receivedTotal)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {RANGES.map((item) => (
          <button
            key={String(item.id)}
            type="button"
            onClick={() => setRange(item.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              range === item.id
                ? "border-brand bg-brand text-ink"
                : "border-line bg-white text-slate-700 hover:bg-[#f7f5f0]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("receivable")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            tab === "receivable"
              ? "border-brand bg-brand text-ink"
              : "border-line bg-white text-slate-700"
          }`}
        >
          Receivable ({receivableRows.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("received")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            tab === "received"
              ? "border-brand bg-brand text-ink"
              : "border-line bg-white text-slate-700"
          }`}
        >
          Received ({receivedRows.length})
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading invoices…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "receivable" ? "No receivables in this range" : "No received invoices in this range"}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((row) => (
            <Link
              key={row.invoice.id}
              href={`/admin/payments/${row.invoice.id}`}
              className="block rounded-xl border border-line bg-white p-4 hover:border-brand/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-black">{row.invoice.invoiceNumber || "Invoice"}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {row.invoice.storeName || "Store"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatInvoiceDate(row.invoice.date)}
                    {isPdcPending(chequeRecord(row.invoice)) ? " · PDC pending" : ""}
                    {row.invoice.grvAmount > 0 ? ` · GRV ${salesMoney(row.invoice.grvAmount)}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-ink">
                    {salesMoney(tab === "receivable" ? row.remaining : row.invoice.amountPaid)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Invoice {salesMoney(row.invoice.totalCost)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tab === "receivable"
                      ? `Received ${salesMoney(row.invoice.amountPaid)}`
                      : "Completed"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

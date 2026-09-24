"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllConfirmedInvoices,
  getPayments,
  getPdcs,
} from "@/lib/api";
import type { GrvOrder, PaymentRecord, PdcRecord } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import {
  collectableAmount,
  formatInvoiceDate,
  invoiceDateOf,
  invoiceNumberOf,
  invoiceStoreName,
  invoiceTotal,
  isPdcPending,
  isWithinDays,
  latestPdc,
  orderGrvAmount,
  paymentOrderId,
  pdcOrderId,
  receivedAmount,
  remainingAmount,
} from "@/lib/invoice";
import { salesMoney } from "@/lib/sales";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

type PaymentsTab = "receivable" | "received";
type RangeKey = 7 | 15 | 30 | null;

const RANGES: { id: RangeKey; label: string }[] = [
  { id: 7, label: "Last 7 days" },
  { id: 15, label: "Last 15 days" },
  { id: 30, label: "Last 30 days" },
  { id: null, label: "All" },
];

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<GrvOrder[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pdcs, setPdcs] = useState<PdcRecord[]>([]);
  const [tab, setTab] = useState<PaymentsTab>("receivable");
  const [range, setRange] = useState<RangeKey>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [invoiceList, paymentList, pdcList] = await Promise.all([
        getAllConfirmedInvoices(user.id),
        getPayments(user.id),
        getPdcs(user.id),
      ]);
      setOrders(invoiceList);
      setPayments(paymentList);
      setPdcs(pdcList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const paymentsByOrder = useMemo(() => {
    const map = new Map<string, PaymentRecord[]>();
    for (const payment of payments) {
      const id = paymentOrderId(payment);
      if (!id) continue;
      const list = map.get(id) || [];
      list.push(payment);
      map.set(id, list);
    }
    return map;
  }, [payments]);

  const pdcsByOrder = useMemo(() => {
    const map = new Map<string, PdcRecord[]>();
    for (const pdc of pdcs) {
      const id = pdcOrderId(pdc);
      if (!id) continue;
      const list = map.get(id) || [];
      list.push(pdc);
      map.set(id, list);
    }
    return map;
  }, [pdcs]);

  const inRange = useMemo(
    () => orders.filter((order) => isWithinDays(invoiceDateOf(order), range)),
    [orders, range],
  );

  const rows = useMemo(() => {
    return inRange.map((order) => {
      const orderPayments = paymentsByOrder.get(order._id) || [];
      const remaining = remainingAmount(order, orderPayments);
      return {
        order,
        payments: orderPayments,
        pdc: latestPdc(pdcsByOrder.get(order._id) || []),
        remaining,
        received: receivedAmount(orderPayments),
        collectable: collectableAmount(order),
        grv: orderGrvAmount(order),
      };
    });
  }, [inRange, paymentsByOrder, pdcsByOrder]);

  const receivableRows = rows.filter((row) => row.remaining > 0.009);
  const receivedRows = rows.filter((row) => row.remaining <= 0.009);
  const visible = tab === "receivable" ? receivableRows : receivedRows;

  const receivableTotal = roundSum(receivableRows.map((row) => row.remaining));
  const receivedTotal = roundSum(receivedRows.map((row) => row.received));

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Open an invoice to mark it completed or attach a post-dated cheque."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
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
          {visible.map((row, index) => (
            <Link
              key={row.order._id || `${invoiceNumberOf(row.order)}-${index}`}
              href={`/admin/payments/${row.order._id}`}
              className="block rounded-xl border border-line bg-white p-4 hover:border-brand/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-black">{invoiceNumberOf(row.order)}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {invoiceStoreName(row.order)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatInvoiceDate(invoiceDateOf(row.order))}
                    {isPdcPending(row.pdc) ? " · PDC pending" : ""}
                    {row.grv > 0 ? ` · GRV ${salesMoney(row.grv)}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-ink">{salesMoney(invoiceTotal(row.order))}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Received {salesMoney(row.received)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tab === "receivable"
                      ? `Due ${salesMoney(row.remaining)}`
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

function roundSum(values: number[]) {
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
}

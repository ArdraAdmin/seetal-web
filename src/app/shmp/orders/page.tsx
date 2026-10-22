"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  shmpCreateDelivery,
  shmpDailyDeliveryReport,
  shmpDeliveries,
  shmpOrderDetail,
  shmpOrders,
  shmpSendToProduction,
} from "@/lib/shmp-api";

export default function ShmpOrdersPage() {
  const [companyId, setCompanyId] = useState("");
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<unknown[]>([]);
  const [detail, setDetail] = useState<unknown>(null);
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");

  async function refresh() {
    try {
      const [o, d] = await Promise.all([
        shmpOrders(companyId ? { companyId } : undefined),
        shmpDeliveries(companyId ? { companyId } : undefined),
      ]);
      setOrders(o as Array<Record<string, unknown>>);
      setDeliveries(d as unknown[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: string) {
    setSelectedOrder(id);
    try {
      const d = (await shmpOrderDetail(id)) as {
        lines?: Array<{ product?: { _id?: string }; ready?: number }>;
      };
      setDetail(d);
      const first = d.lines?.[0]?.product?._id;
      if (first) setProductId(first);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detail failed");
    }
  }

  async function sendProd(id: string) {
    try {
      await shmpSendToProduction(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onDeliver(e: FormEvent) {
    e.preventDefault();
    if (!companyId || !selectedOrder || !productId) return;
    try {
      await shmpCreateDelivery({
        companyId,
        tempOrderId: selectedOrder,
        lines: [
          {
            productId,
            qty: Number(qty),
            unitPrice: unitPrice ? Number(unitPrice) : undefined,
          },
        ],
      });
      await refresh();
      await openDetail(selectedOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery failed");
    }
  }

  async function loadDaily() {
    try {
      setReport(
        await shmpDailyDeliveryReport(
          companyId ? { companyId } : undefined,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Orders & Deliveries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Order → production → partial delivery. Delivery value uses price
          snapshots.
        </p>
      </div>
      <label className="block max-w-md text-sm">
        Company ID
        <input
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Orders</h2>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
            {orders.map((o) => (
              <li
                key={String(o._id)}
                className="flex items-center justify-between gap-2 border-b border-line/50 py-2"
              >
                <button
                  type="button"
                  className="text-left font-medium text-brand-dark"
                  onClick={() => void openDetail(String(o._id))}
                >
                  {String(o.tempOrderInvoiceNo || o._id)}
                </button>
                <span className="text-xs text-slate-500">{String(o.status)}</span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => void sendProd(String(o._id))}
                >
                  To production
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Order quantities</h2>
            <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-2 text-xs">
              {detail ? JSON.stringify(detail, null, 2) : "Select an order"}
            </pre>
          </div>
          <form
            onSubmit={onDeliver}
            className="space-y-2 rounded-2xl border border-line bg-white p-5"
          >
            <h2 className="font-semibold">Partial delivery</h2>
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Product ID"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Unit price (optional snapshot)"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
              disabled={!selectedOrder}
            >
              Confirm delivery
            </button>
          </form>
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Daily delivery report</h2>
          <button
            type="button"
            onClick={() => void loadDaily()}
            className="text-sm font-medium text-brand-dark"
          >
            Generate today
          </button>
        </div>
        <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {report ? JSON.stringify(report, null, 2) : "—"}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          Recent deliveries: {deliveries.length}
        </p>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shmpOrders, type ShmpOrderProgress } from "@/lib/shmp-api";

type OrderRow = Record<string, unknown> & {
  _id?: string;
  tempOrderInvoiceNo?: string;
  status?: string;
  progress?: ShmpOrderProgress;
};

export default function ShmpOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const o = await shmpOrders();
      setOrders(o as OrderRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open an order to assign workers, mark items done, and confirm
            deliveries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-line bg-white p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
            {orders.map((o) => {
              const id = String(o._id);
              const pct = Number(o.progress?.progressPct || 0);
              const done = Number(o.progress?.doneItems || 0);
              const total = Number(o.progress?.totalItems || 0);
              return (
                <li key={id}>
                  <Link
                    href={`/shmp/orders/${id}`}
                    className="block rounded-xl border border-line/60 p-3 transition hover:border-brand hover:bg-brand/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-brand-dark">
                        {String(o.tempOrderInvoiceNo || o._id)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {String(o.status || "")}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>
                          {done} / {total} items done
                        </span>
                        <span className="font-medium text-ink">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            {!orders.length && !error ? (
              <li className="text-slate-500">No SHMP orders yet.</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}

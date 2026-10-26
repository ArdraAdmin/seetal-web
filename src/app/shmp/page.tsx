"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shmpDashboard } from "@/lib/shmp-api";

export default function ShmpDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shmpDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const staff = (data?.staff || {}) as Record<string, number>;
  const ready = (data?.productionReady || []) as Array<Record<string, unknown>>;
  const byCat = (data?.deliveryValueByCategory || []) as Array<{
    _id?: string;
    value?: number;
    qty?: number;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">SHMP Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manufacturing overview — delivery value, production ready, staff.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}. Ensure the API is running and your user has{" "}
          <code>environments</code> including <code>shmp</code>.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Delivery value"
              value={formatMoney(Number(data?.totalDeliveryValue) || 0)}
            />
            <Metric label="Staff present" value={String(staff.present || 0)} />
            <Metric label="Staff absent" value={String(staff.absent || 0)} />
            <Metric
              label="On leave / holiday"
              value={String((staff.leave || 0) + (staff.holiday || 0))}
            />
          </div>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Delivery value by category
            </h2>
            {byCat.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No deliveries in range.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {byCat.map((row, i) => (
                  <li
                    key={String(row._id || i)}
                    className="flex justify-between py-2 text-sm"
                  >
                    <span>{String(row._id || "Uncategorised")}</span>
                    <span className="font-medium">
                      {formatMoney(row.value || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Production ready for delivery
              </h2>
              <Link
                href="/shmp/production"
                className="text-sm font-medium text-brand-dark"
              >
                Open production
              </Link>
            </div>
            {ready.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing ready yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-slate-500">
                      <th className="py-2 pr-4">Order</th>
                      <th className="py-2 pr-4">Product</th>
                      <th className="py-2 pr-4">Produced</th>
                      <th className="py-2 pr-4">Delivered</th>
                      <th className="py-2">Ready</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ready.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-2 pr-4">
                          {String(r.invoiceNo || r.orderId || "")}
                        </td>
                        <td className="py-2 pr-4">
                          {String(r.productId || "")}
                        </td>
                        <td className="py-2 pr-4">{String(r.produced)}</td>
                        <td className="py-2 pr-4">{String(r.delivered)}</td>
                        <td className="py-2 font-medium">{String(r.ready)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function formatMoney(n: number) {
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

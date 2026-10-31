"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DeliverOrderDialog } from "@/components/DeliverOrderDialog";
import { TextField } from "@/components/ui";
import { shmpOrders } from "@/lib/shmp-api";
import { ensureOrderDispatch } from "@/lib/shmp-order-board";
import {
  cartonProgressLabel,
  orderMatchesQuery,
  orderSection,
  orderStoreName,
  type OrderSection,
  type ShmpOrderDispatch,
} from "@/lib/shmp-orders";

type OrderRow = {
  _id?: string;
  tempOrderInvoiceNo?: string;
  status?: string;
  store?: unknown;
  dispatch?: ShmpOrderDispatch | null;
};

const SECTIONS: Array<{ id: OrderSection; label: string; empty: string }> = [
  {
    id: "pending",
    label: "Pending",
    empty: "No pending orders.",
  },
  {
    id: "ready",
    label: "Ready to deliver",
    empty: "No orders are ready to deliver.",
  },
  {
    id: "delivered",
    label: "Delivered",
    empty: "No delivered orders yet.",
  },
];

export default function ShmpOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [section, setSection] = useState<OrderSection>("pending");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliverOrder, setDeliverOrder] = useState<OrderRow | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = (await shmpOrders()) as OrderRow[];
      const withDispatch = await ensureOrderDispatch(list);
      setOrders(withDispatch);
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

  const counts = useMemo(() => {
    const tally: Record<OrderSection, number> = {
      pending: 0,
      ready: 0,
      delivered: 0,
    };
    for (const order of orders) tally[orderSection(order)] += 1;
    return tally;
  }, [orders]);

  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          orderSection(order) === section && orderMatchesQuery(order, query),
      ),
    [orders, query, section],
  );

  const active = SECTIONS.find((item) => item.id === section) || SECTIONS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            New orders start in Pending. Packed cartons move to Ready to
            deliver. Record packing in Production.
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
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((item) => {
          const selected = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setSection(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                selected
                  ? "bg-brand text-ink"
                  : "border border-line bg-white text-slate-600"
              }`}
            >
              {item.label}
              <span className="ml-2 text-xs">{counts[item.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 max-w-md">
          <TextField
            label="Search orders"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice or store name"
          />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
            {visible.map((order) => {
              const id = String(order._id || "");
              const storeName = orderStoreName(order.store);
              return (
                <li
                  key={id}
                  className="rounded-xl border border-line/60 p-3"
                >
                  <Link
                    href={`/shmp/orders/${id}`}
                    className="block rounded-lg transition hover:text-brand-dark"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium text-brand-dark">
                          {String(order.tempOrderInvoiceNo || order._id)}
                        </span>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {storeName || "Store not set"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {String(order.status || "")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {cartonProgressLabel(order.dispatch)}
                    </p>
                  </Link>
                  {section === "ready" ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setDeliverOrder(order);
                        }}
                        className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
                      >
                        Deliver
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {!orders.length && !error ? (
              <li className="text-slate-500">No SHMP orders yet.</li>
            ) : null}
            {orders.length > 0 && visible.length === 0 ? (
              <li className="text-slate-500">
                {query.trim()
                  ? "No orders match that search."
                  : active.empty}
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {deliverOrder?._id ? (
        <DeliverOrderDialog
          open
          orderId={String(deliverOrder._id)}
          invoice={String(
            deliverOrder.tempOrderInvoiceNo || deliverOrder._id,
          )}
          onClose={() => setDeliverOrder(null)}
          onDone={(message) => {
            setNotice(message);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

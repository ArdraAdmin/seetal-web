"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DeliverOrderDialog } from "@/components/DeliverOrderDialog";
import { shmpOrderDetail } from "@/lib/shmp-api";
import { assignedWorkerName } from "@/lib/shmp-order-item";
import {
  cartonProgressLabel,
  dispatchFromLines,
  type ShmpOrderDispatch,
} from "@/lib/shmp-orders";

type AssignedWorker = {
  employee?: string | { _id?: string; name?: string };
  cartonQty?: number;
};

type DetailLine = {
  product?: { _id?: string; itemName?: string; itemRef?: string };
  ordered?: number;
  produced?: number;
  delivered?: number;
  ready?: number;
  remainingProduction?: number;
  productionStatus?: string;
  assignedWorkers?: AssignedWorker[];
};

type OrderDetail = {
  order?: {
    _id?: string;
    status?: string;
    tempOrderInvoiceNo?: string;
  };
  lines?: DetailLine[];
};

export default function ShmpOrderDetailPage() {
  const params = useParams();
  const orderId = String(params?.id || "");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliverOpen, setDeliverOpen] = useState(false);

  async function loadDetail() {
    if (!orderId) return;
    setLoading(true);
    try {
      const next = (await shmpOrderDetail(orderId)) as OrderDetail;
      setDetail(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detail failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const dispatch: ShmpOrderDispatch = dispatchFromLines(detail?.lines || []);
  const invoice = detail?.order?.tempOrderInvoiceNo || orderId || "Order";
  const canDeliver = dispatch.section === "ready";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/shmp/orders"
            className="text-sm font-medium text-brand-dark hover:underline"
          >
            ← All orders
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">{invoice}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {detail?.order?.status ? `Status: ${detail.order.status}` : "Order"}
            {detail ? ` · ${cartonProgressLabel(dispatch)}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dispatch.section !== "delivered" ? (
            <Link
              href={`/shmp/production/${orderId}`}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
            >
              Record packing
            </Link>
          ) : null}
          {canDeliver ? (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setDeliverOpen(true);
              }}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
            >
              Deliver
            </button>
          ) : null}
        </div>
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

      {loading && !detail ? (
        <p className="text-sm text-slate-500">Loading order…</p>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Order items</h2>
          <div className="mt-3 space-y-3">
            {(detail?.lines || []).map((line) => {
              const pid = String(line.product?._id || "");
              return (
                <div
                  key={pid || line.product?.itemRef}
                  className="rounded-xl border border-line/60 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">
                        {line.product?.itemName || "Item"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {line.product?.itemRef || pid}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {String(line.productionStatus || "Pending")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {Number(line.ordered || 0)} ordered ·{" "}
                    {Number(line.produced || 0)} packed ·{" "}
                    {Number(line.ready || 0)} ready ·{" "}
                    {Number(line.delivered || 0)} delivered
                  </p>
                  {(line.assignedWorkers || []).length ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {(line.assignedWorkers || []).map((worker, index) => (
                        <li key={`${pid}-${index}`}>
                          {assignedWorkerName(worker.employee)} ·{" "}
                          {Number(worker.cartonQty || 0)} cartons
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No packing recorded yet
                    </p>
                  )}
                </div>
              );
            })}
            {!detail?.lines?.length ? (
              <p className="text-sm text-slate-500">No items on this order.</p>
            ) : null}
          </div>
        </div>
      )}

      <DeliverOrderDialog
        open={deliverOpen}
        orderId={orderId}
        invoice={invoice}
        onClose={() => setDeliverOpen(false)}
        onDone={(message) => {
          setNotice(message);
          void loadDetail();
        }}
      />
    </div>
  );
}

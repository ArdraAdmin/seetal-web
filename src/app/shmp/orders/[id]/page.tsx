"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DeliverOrderDialog } from "@/components/DeliverOrderDialog";
import { useAuth } from "@/components/AuthProvider";
import { assignedWorkerName, productionStatusClass } from "@/lib/shmp-order-item";
import {
  deliveryLineName,
  deliveryTripCartons,
  deliveryVehicleLabel,
  deliveryVehicleSummary,
  tripsForOrder,
  type OrderDeliveryTrip,
} from "@/lib/shmp-order-deliveries";
import { cachedShmpOrderDetail, shmpDeliveries, shmpOrderDetail } from "@/lib/shmp-api";
import { canEditShmpOrder } from "@/lib/shmp-permissions";
import {
  cartonProgressLabel,
  dispatchFromLines,
  orderStatusClass,
  type ShmpOrderDispatch,
} from "@/lib/shmp-orders";
import { formatProductionLogDate } from "@/lib/shmp-production";

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
  const { user } = useAuth();
  const canEdit = canEditShmpOrder(user);
  const orderId = String(params?.id || "");
  const cached = cachedShmpOrderDetail(orderId) as OrderDetail | undefined;
  const [detail, setDetail] = useState<OrderDetail | null>(cached || null);
  const [trips, setTrips] = useState<OrderDeliveryTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);
  const [deliverOpen, setDeliverOpen] = useState(false);

  async function loadDetail() {
    if (!orderId) return;
    setLoading(true);
    try {
      const [next, deliveryList] = await Promise.all([
        shmpOrderDetail(orderId) as Promise<OrderDetail>,
        shmpDeliveries({ tempOrderId: orderId }) as Promise<OrderDeliveryTrip[]>,
      ]);
      setDetail(next);
      setTrips(
        tripsForOrder(
          Array.isArray(deliveryList) ? deliveryList : [],
          orderId,
        ),
      );
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
  const vehicleLabels = deliveryVehicleSummary(trips);
  const hasDeliveredCartons = (detail?.lines || []).some(
    (line) => (Number(line.delivered) || 0) > 0,
  );
  const showDeliveries = trips.length > 0 || hasDeliveredCartons;

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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {detail?.order?.status ? (
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${orderStatusClass(detail.order.status)}`}
              >
                {detail.order.status}
              </span>
            ) : (
              <span>Order</span>
            )}
            {detail ? (
              <span>· {cartonProgressLabel(dispatch)}</span>
            ) : null}
          </div>
          {vehicleLabels.length ? (
            <p className="mt-1 text-sm text-slate-600">
              Delivered in {vehicleLabels.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && dispatch.section !== "delivered" ? (
            <Link
              href={`/shmp/orders/${orderId}/edit`}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
            >
              Edit order
            </Link>
          ) : null}
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
        <>
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
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${productionStatusClass(line.productionStatus)}`}
                      >
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

          {showDeliveries ? (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold">Delivery vehicles</h2>
              <p className="mt-1 text-sm text-slate-600">
                Vehicles used for trips already sent for this order.
              </p>
              <div className="mt-3 space-y-3">
                {trips.map((trip, index) => {
                  const id = String(trip._id || index);
                  const when = formatProductionLogDate(trip.deliveryDate);
                  const cartons = deliveryTripCartons(trip);
                  return (
                    <div
                      key={id}
                      className="rounded-xl border border-line/60 p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-ink">
                            {deliveryVehicleLabel(trip)}
                          </p>
                          {when ? (
                            <p className="mt-0.5 text-xs text-slate-500">{when}</p>
                          ) : null}
                        </div>
                        <p className="shrink-0 text-xs text-slate-600">
                          {cartons} cartons
                        </p>
                      </div>
                      {(trip.lines || []).length ? (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {(trip.lines || []).map((line, lineIndex) => (
                            <li key={`${id}-${lineIndex}`}>
                              {deliveryLineName(line)} ·{" "}
                              {Number(line.qty || 0)} cartons
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
                {!trips.length ? (
                  <p className="text-sm text-slate-500">
                    Delivered cartons are recorded, but no vehicle trips were
                    found for this order.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
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

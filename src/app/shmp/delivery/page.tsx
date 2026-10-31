"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCompanies } from "@/lib/api";
import { shmpDeliveries } from "@/lib/shmp-api";
import { orderStoreName } from "@/lib/shmp-orders";
import { formatProductionLogDate } from "@/lib/shmp-production";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";

type DeliveryLine = {
  qty?: number;
  product?: { itemName?: string; itemRef?: string } | string | null;
};

type DeliveryTrip = {
  _id?: string;
  deliveryDate?: string;
  vehicleNumber?: number;
  remarks?: string;
  vehicle?: { value?: number | string } | string | null;
  tempOrder?: { _id?: string; tempOrderInvoiceNo?: string } | string | null;
  store?: unknown;
  lines?: DeliveryLine[];
};

function vehicleLabel(trip: DeliveryTrip) {
  const vehicle = trip.vehicle;
  if (vehicle && typeof vehicle === "object" && vehicle.value != null && vehicle.value !== "") {
    return `#${vehicle.value}`;
  }
  if (trip.vehicleNumber != null) return `#${trip.vehicleNumber}`;
  const remarks = String(trip.remarks || "");
  if (remarks.startsWith("Vehicle ")) return remarks.slice("Vehicle ".length);
  return "Vehicle not recorded";
}

function invoiceOf(trip: DeliveryTrip) {
  const order = trip.tempOrder;
  if (order && typeof order === "object") {
    return order.tempOrderInvoiceNo || "Order";
  }
  return "Order";
}

function orderIdOf(trip: DeliveryTrip) {
  const order = trip.tempOrder;
  if (order && typeof order === "object" && order._id) return String(order._id);
  return "";
}

function lineName(line: DeliveryLine) {
  const product = line.product;
  if (product && typeof product === "object") {
    return product.itemName || product.itemRef || "Item";
  }
  return "Item";
}

export default function ShmpDeliveryPage() {
  const [trips, setTrips] = useState<DeliveryTrip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const companies = await getCompanies();
      const companyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";
      const data = await shmpDeliveries(
        companyId ? { companyId } : undefined,
      );
      setTrips(Array.isArray(data) ? (data as DeliveryTrip[]) : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
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
          <h1 className="text-2xl font-bold text-ink">Delivery</h1>
          <p className="mt-1 text-sm text-slate-600">
            Trips already sent. Start a delivery from Orders, under Ready to
            deliver.
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
            {trips.map((trip, index) => {
              const id = String(trip._id || index);
              const orderId = orderIdOf(trip);
              const cartons = (trip.lines || []).reduce(
                (sum, line) => sum + (Number(line.qty) || 0),
                0,
              );
              const when = formatProductionLogDate(trip.deliveryDate);
              return (
                <li
                  key={id}
                  className="rounded-xl border border-line/70 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {orderId ? (
                        <Link
                          href={`/shmp/orders/${orderId}`}
                          className="font-medium text-brand-dark hover:underline"
                        >
                          {invoiceOf(trip)}
                        </Link>
                      ) : (
                        <p className="font-medium text-ink">{invoiceOf(trip)}</p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-600">
                        {orderStoreName(trip.store) || "Store not set"}
                        {when ? ` · ${when}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-ink">
                        {vehicleLabel(trip)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {cartons} cartons
                      </p>
                    </div>
                  </div>
                  {(trip.lines || []).length ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {(trip.lines || []).map((line, lineIndex) => (
                        <li key={`${id}-${lineIndex}`}>
                          {lineName(line)} · {Number(line.qty || 0)} cartons
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {!trips.length && !error ? (
              <li className="text-slate-500">No deliveries yet.</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { getVehicles } from "@/lib/api";
import {
  shmpCreateDelivery,
  shmpDeliveryVehicles,
  shmpOrderDetail,
  type ShmpDeliveryVehicle,
} from "@/lib/shmp-api";
import {
  companyIdOf,
  dispatchFromLines,
  readyDeliveryLines,
  type ReadyDeliveryLine,
} from "@/lib/shmp-orders";

async function loadVehicles(): Promise<ShmpDeliveryVehicle[]> {
  try {
    const list = await shmpDeliveryVehicles();
    if (Array.isArray(list) && list.length) return list;
  } catch {
    /* Shared vehicle list is the fallback when this API is not deployed yet. */
  }
  try {
    const list = await getVehicles();
    return (Array.isArray(list) ? list : []).map((vehicle) => ({
      _id: vehicle._id,
      value: vehicle.value,
    }));
  } catch {
    return [];
  }
}

function vehicleOptionLabel(vehicle: ShmpDeliveryVehicle) {
  if (vehicle.value == null || vehicle.value === "") return "Vehicle";
  return `#${vehicle.value}`;
}

export function DeliverOrderDialog({
  orderId,
  invoice,
  open,
  onClose,
  onDone,
}: {
  orderId: string;
  invoice: string;
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [lines, setLines] = useState<ReadyDeliveryLine[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [vehicles, setVehicles] = useState<ShmpDeliveryVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [willFinish, setWillFinish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const loading = open && loadedKey !== orderId;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setError(null);
    setVehicleId("");
    setLines([]);
    void (async () => {
      try {
        const [detail, vehicleList] = await Promise.all([
          shmpOrderDetail(orderId) as Promise<{
            order?: { company?: unknown };
            lines?: Array<{
              product?: { _id?: string; itemName?: string } | string | null;
              ready?: number;
            }>;
          }>,
          loadVehicles(),
        ]);
        if (cancelled) return;
        const dispatch = dispatchFromLines(detail.lines || []);
        const ordered = Number(dispatch.ordered) || 0;
        const delivered = Number(dispatch.delivered) || 0;
        const ready = Number(dispatch.ready) || 0;
        setCompanyId(companyIdOf(detail.order?.company));
        setLines(readyDeliveryLines(detail.lines || []));
        setWillFinish(ordered > 0 && delivered + ready >= ordered - 0.0001);
        setVehicles(vehicleList);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open delivery");
        }
      } finally {
        if (!cancelled) setLoadedKey(orderId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!vehicleId) {
      setError("Select a vehicle.");
      return;
    }
    if (!companyId) {
      setError("This order has no company.");
      return;
    }
    if (!lines.length) {
      setError("Nothing is packed and waiting to deliver.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const selected = vehicles.find((vehicle) => vehicle._id === vehicleId);
      const result = await shmpCreateDelivery({
        companyId,
        tempOrderId: orderId,
        vehicleId,
        lines: lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
        })),
        remarks: selected ? `Vehicle ${vehicleOptionLabel(selected)}` : undefined,
      });
      const fullyDelivered = result?.dispatch?.section
        ? result.dispatch.section === "delivered"
        : willFinish;
      onDone(
        fullyDelivered
          ? "Delivery recorded. This order is fully delivered."
          : "Delivery recorded. Unpacked cartons stay in production.",
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const cartonTotal = lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deliver-order-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="deliver-order-title" className="text-lg font-semibold text-ink">
            Deliver {invoice}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            This trip includes every carton that is packed and not yet delivered.
          </p>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-slate-500">Loading packed cartons…</p>
          ) : (
            <>
              {lines.length ? (
                <ul className="space-y-2 text-sm">
                  {lines.map((line) => (
                    <li
                      key={line.productId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line/70 px-3 py-2"
                    >
                      <span className="font-medium text-ink">{line.name}</span>
                      <span className="shrink-0 text-slate-600">
                        {line.qty} cartons
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  Nothing is packed and waiting to deliver.
                </p>
              )}
              <p className="text-sm text-slate-600">
                {cartonTotal} cartons on this vehicle. Unpacked cartons stay in
                production.
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink">Vehicle</span>
                <select
                  className="w-full rounded-xl border border-line px-3 py-2"
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  required
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle._id} value={vehicle._id}>
                      {vehicleOptionLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </label>
              {!vehicles.length && !loading ? (
                <p className="text-sm text-slate-500">
                  No vehicles yet. Add one under Drivers and vehicles.
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={loading || saving || !lines.length || !vehicleId}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

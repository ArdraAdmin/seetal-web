"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getVehicles } from "@/lib/api";
import {
  emptyDeliveryLoad,
  loadCartonTotal,
  maxQtyInputForLoad,
  setLoadProductQty,
  unassignedCartons,
  validateAndBuildDeliveryLoads,
  type DeliveryLoadDraft,
} from "@/lib/shmp-delivery-loads";
import {
  shmpCreateDelivery,
  shmpDeliveryVehicles,
  shmpOrderDetail,
  type ShmpDeliveryVehicle,
} from "@/lib/shmp-api";
import {
  companyIdOf,
  readyDeliveryLines,
  type ReadyDeliveryLine,
} from "@/lib/shmp-orders";

async function loadVehicles(): Promise<ShmpDeliveryVehicle[]> {
  try {
    const list = await shmpDeliveryVehicles();
    const shmp = (Array.isArray(list) ? list : []).filter(
      (vehicle) => vehicle.scope === "shmp",
    );
    if (shmp.length) return shmp;
  } catch {
    /* Fall through to the SHMP vehicle list. */
  }
  try {
    const list = await getVehicles("shmp");
    return (Array.isArray(list) ? list : [])
      .filter((vehicle) => vehicle.scope === "shmp")
      .map((vehicle) => ({
        _id: vehicle._id,
        value: vehicle.value,
        scope: vehicle.scope,
      }));
  } catch {
    return [];
  }
}

function vehicleOptionLabel(vehicle: ShmpDeliveryVehicle) {
  if (vehicle.value == null || vehicle.value === "") return "Vehicle";
  return `#${vehicle.value}`;
}

function productIdsOf(lines: ReadyDeliveryLine[]) {
  return lines.map((line) => line.productId);
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
  const [loads, setLoads] = useState<DeliveryLoadDraft[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [vehicles, setVehicles] = useState<ShmpDeliveryVehicle[]>([]);
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
    setLines([]);
    setLoads([]);
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
        const readyLines = readyDeliveryLines(detail.lines || []);
        setCompanyId(companyIdOf(detail.order?.company));
        setLines(readyLines);
        setLoads([emptyDeliveryLoad(productIdsOf(readyLines))]);
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

  const leftover = useMemo(
    () => unassignedCartons(lines, loads),
    [lines, loads],
  );

  function updateLoad(
    key: string,
    patch: (load: DeliveryLoadDraft) => DeliveryLoadDraft,
  ) {
    setLoads((prev) =>
      prev.map((load) => (load.key === key ? patch(load) : load)),
    );
  }

  function addLoad() {
    setLoads((prev) => [...prev, emptyDeliveryLoad(productIdsOf(lines))]);
  }

  function removeLoad(key: string) {
    setLoads((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((load) => load.key !== key);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!companyId) {
      setError("This order has no company.");
      return;
    }
    if (!lines.length) {
      setError("Nothing is packed and waiting to deliver.");
      return;
    }

    const { payloads, error: validationError } = validateAndBuildDeliveryLoads(
      lines,
      loads,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    let created = 0;
    let lastSection: string | undefined;
    try {
      for (const payload of payloads) {
        const selected = vehicles.find(
          (vehicle) => vehicle._id === payload.vehicleId,
        );
        const result = await shmpCreateDelivery({
          companyId,
          tempOrderId: orderId,
          vehicleId: payload.vehicleId,
          lines: payload.lines,
          remarks: selected
            ? `Vehicle ${vehicleOptionLabel(selected)}`
            : undefined,
        });
        created += 1;
        lastSection = result?.dispatch?.section;
      }
      const fullyDelivered = lastSection === "delivered";
      const tripLabel =
        created === 1 ? "1 vehicle trip" : `${created} vehicle trips`;
      onDone(
        fullyDelivered
          ? `Delivery recorded (${tripLabel}). This order is fully delivered.`
          : `Delivery recorded (${tripLabel}). Remaining packed cartons stay ready to deliver.`,
      );
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delivery failed";
      setError(
        created > 0
          ? `${created} trip(s) saved, then failed: ${message}`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const canSubmit = !loading && !saving && lines.length > 0;

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
            Split packed cartons across one or more vehicles. Leave any remainder
            for a later trip.
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
                <div className="rounded-xl border border-line/70 bg-[#faf8f3] px-3 py-2 text-sm text-slate-600">
                  <p className="font-medium text-ink">Ready to deliver</p>
                  <ul className="mt-1 space-y-0.5">
                    {lines.map((line) => (
                      <li key={line.productId}>
                        {line.name}: {line.qty} cartons
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Nothing is packed and waiting to deliver.
                </p>
              )}

              {loads.map((load, index) => {
                const onThisVehicle = loadCartonTotal(load);
                return (
                  <div
                    key={load.key}
                    className="space-y-3 rounded-xl border border-line p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        Vehicle {index + 1}
                      </p>
                      {loads.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeLoad(load.key)}
                          className="text-xs font-medium text-slate-600 hover:text-ink"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-ink">
                        Vehicle
                      </span>
                      <select
                        className="w-full rounded-xl border border-line px-3 py-2"
                        value={load.vehicleId}
                        onChange={(event) =>
                          updateLoad(load.key, (current) => ({
                            ...current,
                            vehicleId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle._id} value={vehicle._id}>
                            {vehicleOptionLabel(vehicle)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {lines.map((line) => {
                      const max = maxQtyInputForLoad(
                        line.qty,
                        loads,
                        line.productId,
                        load.key,
                      );
                      return (
                        <label
                          key={`${load.key}-${line.productId}`}
                          className="block text-sm"
                        >
                          <span className="mb-1 flex items-center justify-between gap-2 font-medium text-ink">
                            <span className="min-w-0 truncate">{line.name}</span>
                            <span className="shrink-0 text-xs font-normal text-slate-500">
                              max {max} · {line.qty} ready
                            </span>
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            step={1}
                            inputMode="numeric"
                            className="w-full rounded-xl border border-line px-3 py-2"
                            value={load.qtys[line.productId] ?? ""}
                            placeholder="0"
                            onChange={(event) => {
                              const next = event.target.value;
                              setLoads((prev) =>
                                setLoadProductQty(
                                  prev,
                                  load.key,
                                  line.productId,
                                  next,
                                  line.qty,
                                ),
                              );
                            }}
                          />
                        </label>
                      );
                    })}

                    <p className="text-xs text-slate-600">
                      {onThisVehicle} cartons on this vehicle
                    </p>
                  </div>
                );
              })}

              {lines.length ? (
                <button
                  type="button"
                  onClick={addLoad}
                  className="w-full rounded-xl border border-dashed border-line px-4 py-2 text-sm font-medium text-ink hover:bg-[#faf8f3]"
                >
                  Add another vehicle
                </button>
              ) : null}

              {lines.length ? (
                <p className="text-sm text-slate-600">
                  {leftover} cartons left unassigned for a later trip.
                </p>
              ) : null}

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
            disabled={!canSubmit}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

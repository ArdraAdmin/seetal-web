"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getCompanies } from "@/lib/api";
import {
  shmpAssignOrderItem,
  shmpEmployees,
  shmpOrderDetail,
  shmpShifts,
} from "@/lib/shmp-api";
import {
  assignedWorkerName,
  isOrderItemDone,
  parseSplitAssignments,
  remainingCartons,
} from "@/lib/shmp-order-item";
import { companyIdOf } from "@/lib/shmp-orders";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  currentShift,
  shiftLabel,
  type ShiftWindow,
} from "@/lib/shmp-shift";

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
  remainingProduction?: number | null;
  productionStatus?: string;
  assignedWorkers?: AssignedWorker[];
};

type OrderDetail = {
  order?: {
    _id?: string;
    status?: string;
    tempOrderInvoiceNo?: string;
    company?: unknown;
  };
  lines?: DetailLine[];
};

type WorkerOption = { _id: string; name?: string };
type ShiftOption = ShiftWindow & { _id: string; name: string };
type SplitRow = { key: string; employeeId: string; cartonQty: string };

function blankRow(key: string): SplitRow {
  return { key, employeeId: "", cartonQty: "" };
}

function freshRow() {
  return blankRow(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

function asShiftList(value: unknown): ShiftOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is ShiftOption => {
    if (!row || typeof row !== "object") return false;
    const shift = row as ShiftOption;
    return Boolean(shift._id && shift.startTime && shift.endTime);
  });
}

function asWorkerList(value: unknown): WorkerOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is WorkerOption => {
    if (!row || typeof row !== "object") return false;
    return Boolean((row as WorkerOption)._id);
  });
}

export default function ShmpProductionOrderPage() {
  const params = useParams();
  const orderId = String(params?.id || "");
  const [companyId, setCompanyId] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [rowsByProduct, setRowsByProduct] = useState<Record<string, SplitRow[]>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const activeShift = currentShift(shifts);

  async function ensureCompany() {
    if (companyId) return companyId;
    const companies = await getCompanies();
    const id = resolveSalesCompanyByKey("shmp", companies)?.id || "";
    if (id) setCompanyId(id);
    return id;
  }

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
    void (async () => {
      try {
        const cid = await ensureCompany();
        const [emps, sh] = await Promise.all([
          shmpEmployees(cid || undefined),
          shmpShifts(cid || undefined),
        ]);
        setWorkers(asWorkerList(emps));
        setShifts(asShiftList(sh));
      } catch {
        setWorkers([]);
        setShifts([]);
      }
      await loadDetail();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function rowsFor(productId: string) {
    return rowsByProduct[productId] || [blankRow(productId)];
  }

  function updateRow(
    productId: string,
    key: string,
    patch: Partial<SplitRow>,
  ) {
    setRowsByProduct((current) => {
      const rows = current[productId] || [blankRow(productId)];
      return {
        ...current,
        [productId]: rows.map((row) =>
          row.key === key ? { ...row, ...patch } : row,
        ),
      };
    });
  }

  function addWorker(productId: string) {
    setRowsByProduct((current) => {
      const rows = current[productId] || [blankRow(productId)];
      return { ...current, [productId]: [...rows, freshRow()] };
    });
  }

  function removeWorker(productId: string, key: string) {
    setRowsByProduct((current) => {
      const rows = (current[productId] || [blankRow(productId)]).filter(
        (row) => row.key !== key,
      );
      return {
        ...current,
        [productId]: rows.length ? rows : [blankRow(productId)],
      };
    });
  }

  async function savePacking(productId: string) {
    const line = (detail?.lines || []).find(
      (row) => String(row.product?._id || "") === productId,
    );
    const remaining = line ? remainingCartons(line) : 0;
    const parsed = parseSplitAssignments(rowsFor(productId), remaining);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!activeShift?._id) {
      setError("No shift is active for the current time.");
      return;
    }
    setBusyId(productId);
    try {
      const cid =
        companyIdOf(detail?.order?.company) || (await ensureCompany());
      await shmpAssignOrderItem(orderId, productId, {
        workers: parsed.workers.map((worker) => ({
          employeeId: worker.employeeId,
          cartonQty: worker.cartonQty,
          designation: "Operator",
        })),
        shiftId: activeShift._id,
        companyId: cid || undefined,
      });
      setRowsByProduct((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setError(null);
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save packing");
    } finally {
      setBusyId("");
    }
  }

  const invoice = detail?.order?.tempOrderInvoiceNo || orderId || "Order";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/shmp/production"
          className="text-sm font-medium text-brand-dark hover:underline"
        >
          ← Production
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">{invoice}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record who packed each item and how many cartons they packed.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {activeShift
            ? `Current shift: ${shiftLabel(activeShift)}`
            : loading
              ? ""
              : "No shift matches the current time."}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
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
              const ordered = Number(line.ordered || 0);
              const remaining = remainingCartons(line);
              const rows = pid ? rowsFor(pid) : [];
              const packed = Number(line.produced || 0);
              const finished =
                isOrderItemDone(line.productionStatus) || remaining <= 0;
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
                        {line.product?.itemRef || pid} · {ordered} cartons
                        ordered · {packed} packed · {remaining} still unpacked
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {String(line.productionStatus || "Pending")}
                    </span>
                  </div>
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
                  {!finished && pid ? (
                    <div className="mt-3 space-y-2">
                      {rows.map((row, index) => (
                        <div
                          key={row.key}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <label className="min-w-[12rem] flex-1">
                            <span className="mb-1 block text-xs text-slate-500">
                              Worker
                            </span>
                            <select
                              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                              value={row.employeeId}
                              onChange={(event) =>
                                updateRow(pid, row.key, {
                                  employeeId: event.target.value,
                                })
                              }
                            >
                              <option value="">Select worker</option>
                              {workers.map((worker) => (
                                <option key={worker._id} value={worker._id}>
                                  {worker.name || worker._id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="w-28">
                            <span className="mb-1 block text-xs text-slate-500">
                              Cartons
                            </span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              inputMode="numeric"
                              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                              value={row.cartonQty}
                              onChange={(event) =>
                                updateRow(pid, row.key, {
                                  cartonQty: event.target.value,
                                })
                              }
                            />
                          </label>
                          {rows.length > 1 ? (
                            <button
                              type="button"
                              className="rounded-xl border border-line px-3 py-2 text-sm"
                              onClick={() => removeWorker(pid, row.key)}
                            >
                              Remove
                            </button>
                          ) : null}
                          {index === 0 && rows.length === 1 ? (
                            <button
                              type="button"
                              className="rounded-xl border border-line px-3 py-2 text-sm font-medium"
                              onClick={() => addWorker(pid)}
                            >
                              Split work
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          className="rounded-xl border border-line px-3 py-2 text-sm font-medium"
                          onClick={() => addWorker(pid)}
                        >
                          Add worker
                        </button>
                      ) : null}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          disabled={busyId === pid || !activeShift}
                          onClick={() => void savePacking(pid)}
                        >
                          {busyId === pid ? "Saving…" : "Save packing"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      {remaining <= 0
                        ? "All cartons for this item are packed."
                        : "This item is already marked done."}
                    </p>
                  )}
                </div>
              );
            })}
            {!detail?.lines?.length ? (
              <p className="text-sm text-slate-500">No items on this order.</p>
            ) : null}
            {!workers.length && detail?.lines?.length ? (
              <p className="text-sm text-slate-500">
                No workers are available to assign.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

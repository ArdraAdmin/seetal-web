"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  shmpAssignOrderItem,
  shmpEmployees,
  shmpOrderDetail,
  shmpShifts,
  type ShmpOrderProgress,
} from "@/lib/shmp-api";
import { getCompanies } from "@/lib/api";
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
  remainingProduction?: number;
  productionStatus?: string;
  assignedWorkers?: AssignedWorker[];
};

type OrderDetail = {
  order?: {
    _id?: string;
    status?: string;
    tempOrderInvoiceNo?: string;
    company?: string | { _id?: string };
  };
  lines?: DetailLine[];
  progress?: ShmpOrderProgress;
};

type WorkerOption = { _id: string; name?: string };
type ShiftOption = ShiftWindow & { _id: string; name: string };

function companyIdOf(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_id" in value) {
    return String((value as { _id?: string })._id || "");
  }
  return "";
}

function workerName(row: AssignedWorker) {
  const emp = row.employee;
  if (!emp) return "Worker";
  if (typeof emp === "string") return emp;
  return emp.name || emp._id || "Worker";
}

function remainingCartons(line: DetailLine) {
  const remaining = Number(line.remainingProduction);
  if (Number.isFinite(remaining) && remaining >= 0) return remaining;
  return Math.max(0, Number(line.ordered || 0) - Number(line.produced || 0));
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

export default function ShmpOrderDetailPage() {
  const params = useParams();
  const orderId = String(params?.id || "");

  const [companyId, setCompanyId] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [workerByProduct, setWorkerByProduct] = useState<Record<string, string>>(
    {},
  );
  const [busy, setBusy] = useState(false);
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
      const d = (await shmpOrderDetail(orderId)) as OrderDetail;
      setDetail(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detail failed");
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
        /* workers/shifts are required to assign; detail can still load */
      }
      await loadDetail();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function assignItem(e: FormEvent, productId: string) {
    e.preventDefault();
    const workerId = workerByProduct[productId];
    const line = (detail?.lines || []).find(
      (row) => String(row.product?._id || "") === productId,
    );
    const cartonQty = line ? remainingCartons(line) : 0;
    if (!orderId || !productId || !workerId) return;
    if (!activeShift?._id) {
      setError("No shift is active for the current time.");
      return;
    }
    if (cartonQty <= 0) {
      setError("This item has no remaining cartons to assign.");
      return;
    }
    setBusy(true);
    try {
      const cid =
        companyIdOf(detail?.order?.company) || (await ensureCompany());
      await shmpAssignOrderItem(orderId, productId, {
        workers: [
          {
            employeeId: workerId,
            cartonQty,
            designation: "Operator",
          },
        ],
        shiftId: activeShift._id,
        companyId: cid || undefined,
      });
      setWorkerByProduct((current) => ({ ...current, [productId]: "" }));
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  const orderProgress = useMemo(() => {
    return detail?.progress || { totalItems: 0, doneItems: 0, progressPct: 0 };
  }, [detail]);

  const invoice = detail?.order?.tempOrderInvoiceNo || orderId || "Order";

  return (
    <div className="space-y-6">
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
          {detail
            ? ` · ${Number(orderProgress.doneItems || 0)} / ${Number(orderProgress.totalItems || 0)} items · ${Number(orderProgress.progressPct || 0)}%`
            : null}
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
              const status = String(line.productionStatus || "Pending");
              const ordered = Number(line.ordered || 0);
              const remaining = remainingCartons(line);
              const done = status === "Done" || remaining <= 0;
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
                        ordered
                        {remaining !== ordered
                          ? ` · ${remaining} remaining`
                          : null}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        status === "Done"
                          ? "bg-emerald-50 text-emerald-700"
                          : status === "Assigned"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  {(line.assignedWorkers || []).length ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {(line.assignedWorkers || []).map((w, i) => (
                        <li key={`${pid}-${i}`}>
                          {workerName(w)} · {Number(w.cartonQty || 0)} cartons
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No workers assigned yet
                    </p>
                  )}
                  {!done && pid ? (
                    <form
                      onSubmit={(e) => void assignItem(e, pid)}
                      className="mt-3 flex flex-wrap items-end gap-2"
                    >
                      <label className="min-w-[12rem] flex-1">
                        <span className="sr-only">Worker</span>
                        <select
                          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                          value={workerByProduct[pid] || ""}
                          onChange={(e) =>
                            setWorkerByProduct((current) => ({
                              ...current,
                              [pid]: e.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Assign worker</option>
                          {workers.map((w) => (
                            <option key={w._id} value={w._id}>
                              {w.name || w._id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        disabled={busy || !workerByProduct[pid] || !activeShift}
                      >
                        Assign
                      </button>
                    </form>
                  ) : null}
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

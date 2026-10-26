"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  shmpAssignOrderItem,
  shmpCreateDelivery,
  shmpEmployees,
  shmpMarkOrderItemDone,
  shmpOrderDetail,
  shmpShifts,
  shmpStartOrder,
  type ShmpOrderProgress,
} from "@/lib/shmp-api";
import { getCompanies } from "@/lib/api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";

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

export default function ShmpOrderDetailPage() {
  const params = useParams();
  const orderId = String(params?.id || "");

  const [companyId, setCompanyId] = useState("");
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [workers, setWorkers] = useState<Array<{ _id: string; name?: string }>>(
    [],
  );
  const [shifts, setShifts] = useState<Array<{ _id: string; name: string }>>(
    [],
  );
  const [shiftId, setShiftId] = useState("");
  const [assignProductId, setAssignProductId] = useState("");
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignCartons, setAssignCartons] = useState("1");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const first = d.lines?.[0]?.product?._id;
      if (first) {
        setProductId(first);
        setAssignProductId(first);
      }
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
          shmpEmployees(cid || undefined) as Promise<
            Array<{ _id: string; name?: string }>
          >,
          shmpShifts(cid || undefined) as Promise<
            Array<{ _id: string; name: string }>
          >,
        ]);
        setWorkers(Array.isArray(emps) ? emps : []);
        setShifts(Array.isArray(sh) ? sh : []);
        if (sh[0]) setShiftId(sh[0]._id);
      } catch {
        /* optional */
      }
      await loadDetail();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function startProcessing() {
    if (!orderId) return;
    setBusy(true);
    try {
      await shmpStartOrder(orderId);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start order");
    } finally {
      setBusy(false);
    }
  }

  async function assignItem(e: FormEvent) {
    e.preventDefault();
    if (!orderId || !assignProductId || !assignWorkerId) return;
    setBusy(true);
    try {
      const cid =
        companyIdOf(detail?.order?.company) || (await ensureCompany());
      await shmpAssignOrderItem(orderId, assignProductId, {
        workers: [
          {
            employeeId: assignWorkerId,
            cartonQty: Number(assignCartons) || 1,
            designation: "Operator",
          },
        ],
        shiftId: shiftId || undefined,
        companyId: cid || undefined,
      });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function markDone(productIdValue: string) {
    if (!orderId) return;
    setBusy(true);
    try {
      await shmpMarkOrderItemDone(orderId, productIdValue);
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark Done");
    } finally {
      setBusy(false);
    }
  }

  async function onDeliver(e: FormEvent) {
    e.preventDefault();
    const cid = companyId || (await ensureCompany());
    if (!cid || !orderId || !productId) return;
    try {
      await shmpCreateDelivery({
        companyId: cid,
        tempOrderId: orderId,
        lines: [
          {
            productId,
            qty: Number(qty),
            unitPrice: unitPrice ? Number(unitPrice) : undefined,
          },
        ],
      });
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delivery failed");
    }
  }

  const orderProgress = useMemo(() => {
    return detail?.progress || { totalItems: 0, doneItems: 0, progressPct: 0 };
  }, [detail]);

  const invoice =
    detail?.order?.tempOrderInvoiceNo || orderId || "Order";

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
            {detail?.order?.status
              ? `Status: ${detail.order.status}`
              : "Assign workers, mark items done, and confirm deliveries."}
            {detail
              ? ` · ${Number(orderProgress.doneItems || 0)} / ${Number(orderProgress.totalItems || 0)} items · ${Number(orderProgress.progressPct || 0)}%`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startProcessing()}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            Start processing
          </button>
          <button
            type="button"
            onClick={() => void loadDetail()}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading && !detail ? (
        <p className="text-sm text-slate-500">Loading order…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Order items</h2>
            <div className="mt-3 space-y-3">
              {(detail?.lines || []).map((line) => {
                const pid = String(line.product?._id || "");
                const status = String(line.productionStatus || "Pending");
                const ordered = Number(line.ordered || 0);
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
                    {status !== "Done" && pid ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void markDone(pid)}
                        className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                      >
                        Mark Done
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {!detail?.lines?.length ? (
                <p className="text-sm text-slate-500">No items on this order.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={assignItem}
              className="space-y-2 rounded-2xl border border-line bg-white p-5"
            >
              <h2 className="font-semibold">Assign worker to item</h2>
              <p className="text-xs text-slate-500">
                Assignment is logged as carton production for the worker.
              </p>
              <select
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                value={assignProductId}
                onChange={(e) => setAssignProductId(e.target.value)}
              >
                <option value="">Select item</option>
                {(detail?.lines || []).map((line) => {
                  const pid = String(line.product?._id || "");
                  if (!pid || line.productionStatus === "Done") return null;
                  return (
                    <option key={pid} value={pid}>
                      {line.product?.itemName || pid}
                    </option>
                  );
                })}
              </select>
              <select
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                value={assignWorkerId}
                onChange={(e) => setAssignWorkerId(e.target.value)}
              >
                <option value="">Worker</option>
                {workers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name || w._id}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value)}
              >
                <option value="">Shift (optional if only one)</option>
                {shifts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                type="number"
                min={1}
                step={1}
                placeholder="Cartons assigned"
                value={assignCartons}
                onChange={(e) => setAssignCartons(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold disabled:opacity-60"
                disabled={busy}
              >
                Assign & log cartons
              </button>
            </form>

            <form
              onSubmit={onDeliver}
              className="space-y-2 rounded-2xl border border-line bg-white p-5"
            >
              <h2 className="font-semibold">Partial delivery</h2>
              <select
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Select item</option>
                {(detail?.lines || []).map((line) => {
                  const pid = String(line.product?._id || "");
                  if (!pid) return null;
                  return (
                    <option key={pid} value={pid}>
                      {line.product?.itemName || pid}
                    </option>
                  );
                })}
              </select>
              <input
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                placeholder="Qty (cartons)"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                placeholder="Unit price (optional)"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
              >
                Confirm delivery
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  shmpCloseShift,
  shmpCreateProductionEntry,
  shmpCreateShift,
  shmpOpenShift,
  shmpOrders,
  shmpPresentStaff,
  shmpProductionDashboard,
  shmpProductionEntries,
  shmpShifts,
  shmpSubmitProductionEntry,
} from "@/lib/shmp-api";

export default function ShmpProductionPage() {
  const [companyId, setCompanyId] = useState("");
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(
    null,
  );
  const [shifts, setShifts] = useState<Array<{ _id: string; name: string }>>(
    [],
  );
  const [entries, setEntries] = useState<unknown[]>([]);
  const [orders, setOrders] = useState<Array<{ _id: string; tempOrderInvoiceNo?: string; productDetails?: Array<{ product: string; quantityReq: number }> }>>([]);
  const [present, setPresent] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState("");
  const [shiftName, setShiftName] = useState("Morning");
  const [shiftCode, setShiftCode] = useState("AM");
  const [instanceId, setInstanceId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [operatorId, setOperatorId] = useState("");
  const [helperId, setHelperId] = useState("");

  async function refresh() {
    setError(null);
    try {
      const [dash, sh, ents, ords] = await Promise.all([
        shmpProductionDashboard(
          companyId ? { companyId } : undefined,
        ) as Promise<Record<string, unknown>>,
        shmpShifts(companyId || undefined) as Promise<
          Array<{ _id: string; name: string }>
        >,
        shmpProductionEntries(
          companyId ? { companyId } : undefined,
        ) as Promise<unknown[]>,
        shmpOrders(
          companyId ? { companyId } : undefined,
        ) as Promise<typeof orders>,
      ]);
      setDashboard(dash);
      setShifts(sh);
      setEntries(ents);
      setOrders(ords);
      if (sh[0] && !shiftId) setShiftId(sh[0]._id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPresent() {
    if (!companyId) return;
    try {
      const list = await shmpPresentStaff({
        companyId,
        date: new Date().toISOString(),
        shiftId: shiftId || undefined,
      });
      setPresent(list as unknown[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Present staff failed");
    }
  }

  async function createShift(e: FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    try {
      await shmpCreateShift({
        company: companyId,
        name: shiftName,
        code: shiftCode,
        startTime: "08:00",
        endTime: "16:00",
        endsNextDay: false,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shift create failed");
    }
  }

  async function openShift() {
    if (!companyId || !shiftId) return;
    try {
      const inst = (await shmpOpenShift({
        companyId,
        shiftId,
        date: new Date().toISOString(),
      })) as { _id: string };
      setInstanceId(inst._id);
      await loadPresent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Open shift failed");
    }
  }

  async function closeShift() {
    if (!instanceId) return;
    try {
      await shmpCloseShift(instanceId);
      setInstanceId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Close shift failed");
    }
  }

  async function logProduction(e: FormEvent) {
    e.preventDefault();
    if (!companyId || !shiftId || !productId) return;
    const contributions = [];
    if (operatorId) {
      contributions.push({
        employee: operatorId,
        designation: "Operator",
        weight: 1,
      });
    }
    if (helperId) {
      contributions.push({
        employee: helperId,
        designation: "Helper",
        weight: 1,
      });
    }
    try {
      const entry = (await shmpCreateProductionEntry({
        company: companyId,
        shift: shiftId,
        date: new Date().toISOString(),
        tempOrder: orderId || undefined,
        product: productId,
        qtyProduced: Number(qty),
        qtyPackaged: Number(qty),
        contributions,
        status: "draft",
        shiftInstanceKey: instanceId
          ? undefined
          : `${companyId}:${shiftId}:${new Date().toISOString().slice(0, 10)}`,
      })) as { _id: string };
      await shmpSubmitProductionEntry(entry._id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Log failed");
    }
  }

  const presentEmps = present as Array<{
    employee?: { _id: string; name: string };
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Production</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operational metrics only — no sales or production monetary values.
        </p>
      </div>

      <label className="block max-w-md text-sm">
        <span className="font-medium">Company ID</span>
        <input
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        />
      </label>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Pending orders"
          value={String(dashboard?.pendingOrdersCount ?? "—")}
        />
        <Metric label="Entries loaded" value={String(entries.length)} />
        <Metric label="Shifts defined" value={String(shifts.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={createShift}
          className="space-y-3 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-semibold">Define shift</h2>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={shiftName}
            onChange={(e) => setShiftName(e.target.value)}
            placeholder="Name"
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={shiftCode}
            onChange={(e) => setShiftCode(e.target.value)}
            placeholder="Code"
          />
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">
            Save shift
          </button>
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
          >
            <option value="">Select shift</option>
            {shifts.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void openShift()}
              className="rounded-xl border border-line px-3 py-2 text-sm"
            >
              Open shift
            </button>
            <button
              type="button"
              onClick={() => void closeShift()}
              className="rounded-xl border border-line px-3 py-2 text-sm"
              disabled={!instanceId}
            >
              Close & email PDF
            </button>
          </div>
          {instanceId ? (
            <p className="text-xs text-slate-500">Open instance: {instanceId}</p>
          ) : null}
        </form>

        <form
          onSubmit={logProduction}
          className="space-y-3 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-semibold">Log production</h2>
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value);
              const o = orders.find((x) => x._id === e.target.value);
              const p = o?.productDetails?.[0]?.product;
              if (p) setProductId(typeof p === "string" ? p : String(p));
            }}
          >
            <option value="">Order (optional)</option>
            {orders.map((o) => (
              <option key={o._id} value={o._id}>
                {o.tempOrderInvoiceNo || o._id}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Product ID"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="Qty produced"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void loadPresent()}
            className="text-sm font-medium text-brand-dark"
          >
            Load present staff for shift
          </button>
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            <option value="">Operator</option>
            {presentEmps.map((p, i) =>
              p.employee ? (
                <option key={i} value={p.employee._id}>
                  {p.employee.name}
                </option>
              ) : null,
            )}
          </select>
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={helperId}
            onChange={(e) => setHelperId(e.target.value)}
          >
            <option value="">Helper</option>
            {presentEmps.map((p, i) =>
              p.employee ? (
                <option key={`h-${i}`} value={p.employee._id}>
                  {p.employee.name}
                </option>
              ) : null,
            )}
          </select>
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold">
            Submit entry
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Day / shift totals</h2>
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(dashboard?.byDay || [], null, 2)}
        </pre>
      </section>
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

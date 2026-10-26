"use client";

import { useEffect, useState } from "react";
import {
  shmpProductionDashboard,
  shmpProductionLogs,
  type ShmpProductionDashboard,
} from "@/lib/shmp-api";
import { getCompanies } from "@/lib/api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";

type WorkerLog = NonNullable<ShmpProductionDashboard["byWorker"]>[number];

export default function ShmpProductionPage() {
  const [companyId, setCompanyId] = useState("");
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function ensureCompany() {
    if (companyId) return companyId;
    const companies = await getCompanies();
    const id = resolveSalesCompanyByKey("shmp", companies)?.id || "";
    if (id) setCompanyId(id);
    return id;
  }

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const cid = await ensureCompany();
      const params = cid ? { companyId: cid } : undefined;
      const [dash, logRes] = await Promise.all([
        shmpProductionDashboard(params) as Promise<ShmpProductionDashboard>,
        shmpProductionLogs(params) as Promise<{ logs?: WorkerLog[] }>,
      ]);
      setLogs(
        Array.isArray(logRes?.logs)
          ? logRes.logs
          : Array.isArray(dash?.byWorker)
            ? dash.byWorker
            : [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Daily production log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Worker · company · order · item · cartons
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

      <section className="rounded-2xl border border-line bg-white p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
            {logs.map((row, i) => (
              <li
                key={`${row.order?._id || "x"}-${row.item?._id || i}-${i}`}
                className="rounded-xl border border-line/70 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {row.worker?.name || "Worker"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.company?.name || "Company"} ·{" "}
                      {row.order?.invoiceNo || "No order"} ·{" "}
                      {row.item?.name || row.item?.itemRef || "Item"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-ink">
                    {Number(row.cartonQty || 0)} ctn
                  </span>
                </div>
              </li>
            ))}
            {!logs.length ? (
              <li className="text-slate-500">No logs for today.</li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}

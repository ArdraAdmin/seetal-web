"use client";

import { useEffect, useMemo, useState } from "react";
import { TextField } from "@/components/ui";
import { shmpProductionLogs } from "@/lib/shmp-api";
import { getCompanies } from "@/lib/api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  formatPackedCartonsValue,
  formatProductionLogDate,
  productionLogMatchesQuery,
  productionLogStoreName,
  type ShmpProductionLog,
} from "@/lib/shmp-production";

export default function ShmpProductionPage() {
  const [companyId, setCompanyId] = useState("");
  const [logs, setLogs] = useState<ShmpProductionLog[]>([]);
  const [todayCartons, setTodayCartons] = useState(0);
  const [todayValue, setTodayValue] = useState(0);
  const [query, setQuery] = useState("");
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
    try {
      const cid = await ensureCompany();
      setError(null);
      setLoading(true);
      const params = cid ? { companyId: cid } : undefined;
      const logRes = await shmpProductionLogs(params);
      setLogs(Array.isArray(logRes?.logs) ? logRes.logs : []);
      setTodayCartons(Number(logRes?.todayCartons) || 0);
      setTodayValue(Number(logRes?.todayValue) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Fetch on mount only; refresh() also runs from the Refresh button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(
    () => logs.filter((row) => productionLogMatchesQuery(row, query)),
    [logs, query],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Daily production log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Packed cartons today, then the worker log for each order.
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Cartons packed"
          value={String(todayCartons)}
        />
        <Metric
          label="Packed cartons value"
          value={formatPackedCartonsValue(todayValue)}
        />
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4 max-w-md">
          <TextField
            label="Search logs"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Worker, store, invoice, or item"
          />
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
            {visible.map((row, i) => {
              const storeName = productionLogStoreName(row);
              const packedDate = formatProductionLogDate(row.date);
              return (
                <li
                  key={`${row.order?._id || "x"}-${row.item?._id || i}-${i}`}
                  className="rounded-xl border border-line/70 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {row.worker?.name || "Worker"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {storeName || "Store not set"}
                        {packedDate ? ` · ${packedDate}` : ""}
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
              );
            })}
            {!logs.length ? (
              <li className="text-slate-500">No logs for today.</li>
            ) : null}
            {logs.length > 0 && visible.length === 0 ? (
              <li className="text-slate-500">No logs match that search.</li>
            ) : null}
          </ul>
        )}
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

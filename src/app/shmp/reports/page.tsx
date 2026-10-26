"use client";

import { useEffect, useState } from "react";
import { shmpReports, shmpSaveRecipients, shmpReportRecipients } from "@/lib/shmp-api";

export default function ShmpReportsPage() {
  const [reports, setReports] = useState<unknown[]>([]);
  const [recipients, setRecipients] = useState<unknown[]>([]);
  const [emails, setEmails] = useState("");
  const [reportType, setReportType] = useState("shift_production");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setReports((await shmpReports()) as unknown[]);
      try {
        setRecipients((await shmpReportRecipients()) as unknown[]);
      } catch {
        /* admin-only */
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function saveRecipients() {
    try {
      await shmpSaveRecipients({
        reportType,
        emails: emails
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        timezone: "Asia/Dubai",
        enabled: true,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Shift PDFs on close, monthly production on the 1st, delivery reports.
          Recipients are configured here — not hardcoded.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Recipient config (Admin)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-line px-3 py-2 text-sm"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="shift_production">Shift production</option>
            <option value="monthly_production">Monthly production</option>
            <option value="daily_delivery">Daily delivery</option>
            <option value="monthly_attendance">Monthly attendance</option>
            <option value="fleet_expiry">Fleet expiry</option>
          </select>
          <input
            className="min-w-[240px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
            placeholder="emails, comma-separated"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void saveRecipients()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
          >
            Save
          </button>
        </div>
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-50 p-2 text-xs">
          {JSON.stringify(recipients, null, 2)}
        </pre>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Generated reports</h2>
        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(reports, null, 2)}
        </pre>
      </section>
    </div>
  );
}

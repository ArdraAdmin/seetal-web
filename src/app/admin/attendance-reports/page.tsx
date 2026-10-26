"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  CompanySwitcher,
  fmtDubai,
  useDubaiNow,
} from "@/components/StlFeatureUi";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import {
  getSalesAttendanceReport,
  type CompanyKey,
} from "@/lib/stl-features-api";

type Report = Awaited<ReturnType<typeof getSalesAttendanceReport>>;

function monthStart(iso: string) {
  return `${iso.slice(0, 8)}01`;
}

export default function AdminAttendanceReportsPage() {
  const { user } = useAuth();
  const dubai = useDubaiNow();
  const [companyKey, setCompanyKey] = useState<CompanyKey | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFrom((v) => v || monthStart(dubai.isoDate));
    setTo((v) => v || dubai.isoDate);
  }, [dubai.isoDate]);

  const load = useCallback(async () => {
    if (!user?.id || !from || !to) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await getSalesAttendanceReport(user.id, { companyKey, from, to }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyKey, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportExcel() {
    if (!report) return;
    const XLSX = await import("xlsx");
    const summary = report.rows.map((r) => ({
      Salesman: r.sales.name,
      Email: r.sales.email,
      Present: r.summary.present,
      Absent: r.summary.absent,
      Leave: r.summary.leave,
      Days: r.summary.days,
    }));
    const detail = report.rows.flatMap((r) =>
      r.days.map((d) => ({
        Salesman: r.sales.name,
        Date: d.date,
        Status: d.status,
        "Check in": d.checkInAt ? fmtDubai(d.checkInAt) : "",
        "Check out": d.checkOutAt ? fmtDubai(d.checkOutAt) : "",
        Overridden: d.overridden ? "Yes" : "",
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(detail), "Daily");
    XLSX.writeFile(book, `attendance-${report.from}_${report.to}.xlsx`);
  }

  return (
    <div>
      <style>{`@media print {
        aside, .no-print, button { display: none !important; }
        body { background: #fff !important; }
        div[class*="lg:pl-"] { padding-left: 0 !important; }
      }`}</style>
      <PageHeader
        title="Attendance reports"
        subtitle={`Salesman attendance summary${report ? ` · ${report.timezone}` : " (Dubai time)"}.`}
        actions={
          <div className="no-print flex gap-2">
            <SecondaryButton type="button" disabled={!report} onClick={() => void exportExcel()}>
              Export Excel
            </SecondaryButton>
            <PrimaryButton type="button" disabled={!report} onClick={() => window.print()}>
              Print / PDF
            </PrimaryButton>
          </div>
        }
      />

      <Card className="no-print mb-4 flex flex-wrap items-end gap-3">
        <CompanySwitcher allowAll value={companyKey} onChange={setCompanyKey} />
        <div className="w-44">
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="w-44">
          <TextField label="To" type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </SecondaryButton>
      </Card>

      {loading && !report ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : report ? (
        report.rows.length === 0 ? (
          <EmptyState title="No attendance data for this range" />
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-500">
              {report.from} → {report.to} · {report.companyKey?.toUpperCase()}
            </p>
            <div className="overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2">Salesman</th>
                    <th className="px-4 py-2 text-right">Present</th>
                    <th className="px-4 py-2 text-right">Absent</th>
                    <th className="px-4 py-2 text-right">Leave</th>
                    <th className="px-4 py-2 text-right">Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.rows.map((r) => (
                    <tr key={r.sales.id}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{r.sales.name}</p>
                        <p className="text-xs text-slate-500">{r.sales.email}</p>
                      </td>
                      <td className="px-4 py-2 text-right text-emerald-700">{r.summary.present}</td>
                      <td className="px-4 py-2 text-right text-red-700">{r.summary.absent}</td>
                      <td className="px-4 py-2 text-right text-amber-700">{r.summary.leave}</td>
                      <td className="px-4 py-2 text-right">{r.summary.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Card, PageHeader, PrimaryButton, TextField } from "@/components/ui";
import { isAdmin, isSupervisor } from "@/lib/auth";
import { getCompanies } from "@/lib/api";
import { isShmpAttendancePortalRole } from "@/lib/hr-scope";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  shmpAccessUsers,
  shmpAttendance,
  shmpEmployees,
  shmpProductionLogs,
  shmpReportRecipients,
  shmpSaveRecipients,
  type ShmpAccessUser,
} from "@/lib/shmp-api";
import {
  buildAttendanceReport,
  buildProductionReport,
  downloadPdf,
  dubaiRangeInstants,
  dubaiToday,
  formatDubaiStamp,
  formatIsoDateLabel,
  formatMonthLabel,
  loadProductionLogs,
  monthBoundsIso,
  renderAttendanceReport,
  renderProductionReport,
  type ReportPerson,
} from "@/lib/shmp-reports";
import { usersVisibleToSupervisor } from "../hr/shared";

type Busy =
  | "daily-production"
  | "monthly-production"
  | "daily-attendance"
  | "monthly-attendance"
  | null;

type Recipient = {
  _id?: string;
  reportType?: string;
  emails?: string[];
  enabled?: boolean;
};

type RosterEmployee = {
  _id?: string;
  name?: string;
  designation?: string;
  isActive?: boolean;
};

const RECIPIENT_LABELS: Record<string, string> = {
  shift_production: "Shift production",
  monthly_production: "Monthly production",
  daily_delivery: "Daily delivery",
  monthly_attendance: "Monthly attendance",
  fleet_expiry: "Fleet expiry",
};

export default function ShmpReportsPage() {
  const { user } = useAuth();
  const supervisor = isSupervisor(user);
  const admin = isAdmin(user);
  const [productionDay, setProductionDay] = useState(dubaiToday);
  const [productionMonth, setProductionMonth] = useState(() => dubaiToday().slice(0, 7));
  const [attendanceDay, setAttendanceDay] = useState(dubaiToday);
  const [attendanceMonth, setAttendanceMonth] = useState(() => dubaiToday().slice(0, 7));
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [emails, setEmails] = useState("");
  const [reportType, setReportType] = useState("monthly_production");

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    void shmpReportRecipients()
      .then((rows) => {
        if (!cancelled) setRecipients(Array.isArray(rows) ? (rows as Recipient[]) : []);
      })
      .catch(() => {
        if (!cancelled) setRecipients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  async function ensureCompany() {
    if (companyId) return companyId;
    const companies = await getCompanies();
    const id = resolveSalesCompanyByKey("shmp", companies)?.id || "";
    if (id) setCompanyId(id);
    return id;
  }

  async function downloadProduction(kind: "daily" | "monthly") {
    const key = kind === "daily" ? "daily-production" : "monthly-production";
    setBusy(key);
    setError(null);
    try {
      const period = kind === "daily" ? productionDay : productionMonth;
      const range =
        kind === "daily" ? { from: productionDay, to: productionDay } : monthBoundsIso(productionMonth);
      if (!range?.from || !range.to) throw new Error("Choose a valid period");
      const id = await ensureCompany();
      const loaded = await loadProductionLogs(range, id, shmpProductionLogs);
      const report = buildProductionReport({
        title: kind === "daily" ? "Daily production report" : "Monthly production report",
        periodLabel:
          kind === "daily" ? formatIsoDateLabel(productionDay) : formatMonthLabel(productionMonth),
        generatedLabel: formatDubaiStamp(new Date()),
        logs: loaded.logs,
        cartons: loaded.cartons,
        value: loaded.value,
        showValue: !supervisor,
      });
      downloadPdf(
        renderProductionReport(report),
        `shmp-${kind}-production-${period}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the report");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAttendance(kind: "daily" | "monthly") {
    const key = kind === "daily" ? "daily-attendance" : "monthly-attendance";
    setBusy(key);
    setError(null);
    try {
      const period = kind === "daily" ? attendanceDay : attendanceMonth;
      const range =
        kind === "daily"
          ? { from: attendanceDay, to: attendanceDay }
          : monthBoundsIso(attendanceMonth);
      if (!range?.from || !range.to) throw new Error("Choose a valid period");
      const instants = dubaiRangeInstants(range.from, range.to);
      if (!instants) throw new Error("Choose a valid period");
      const id = await ensureCompany();
      const [employeeRows, accessUsers, attendanceRows] = await Promise.all([
        shmpEmployees(id || undefined),
        shmpAccessUsers().catch(() => [] as ShmpAccessUser[]),
        shmpAttendance({
          mine: "0",
          from: instants.from,
          to: instants.to,
          ...(id ? { companyId: id } : {}),
        }),
      ]);
      const employees = (Array.isArray(employeeRows) ? employeeRows : []) as RosterEmployee[];
      const portal = (
        supervisor ? usersVisibleToSupervisor(accessUsers) : accessUsers
      ).filter((row) => isShmpAttendancePortalRole(row.role));
      const people: ReportPerson[] = [
        ...employees
          .filter((employee) => employee._id && employee.isActive !== false)
          .map((employee) => ({
            key: `worker:${employee._id}`,
            name: employee.name || "Worker",
            role: employee.designation || "Worker",
          })),
        ...portal
          .filter((row) => row._id)
          .map((row) => ({
            key: `portal:${row._id}`,
            name: row.name || row.email || "Supervisor",
            role: row.role || "Supervisor",
          })),
      ];
      const report = buildAttendanceReport({
        title: kind === "daily" ? "Daily attendance report" : "Monthly attendance report",
        periodLabel:
          kind === "daily" ? formatIsoDateLabel(attendanceDay) : formatMonthLabel(attendanceMonth),
        generatedLabel: formatDubaiStamp(new Date()),
        from: range.from,
        to: range.to,
        people,
        rows: Array.isArray(attendanceRows) ? attendanceRows : [],
      });
      downloadPdf(
        renderAttendanceReport(report),
        `shmp-${kind}-attendance-${period}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the report");
    } finally {
      setBusy(null);
    }
  }

  async function saveRecipients() {
    try {
      setError(null);
      await shmpSaveRecipients({
        reportType,
        emails: emails
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        timezone: "Asia/Dubai",
        enabled: true,
      });
      const rows = await shmpReportRecipients();
      setRecipients(Array.isArray(rows) ? (rows as Recipient[]) : []);
      setEmails("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  const productionDetail = supervisor
    ? "Total cartons packed, every packing log, and the worker who packed the most cartons."
    : "Total cartons packed, their value, every packing log, and the worker who packed the most cartons.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Download a PDF for production or attendance. Dates use Dubai time."
      />
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="Daily production report"
          detail={productionDetail}
          label="Date"
          type="date"
          value={productionDay}
          onChange={setProductionDay}
          busy={busy === "daily-production"}
          disabled={!productionDay || busy !== null}
          onDownload={() => void downloadProduction("daily")}
        />
        <ReportCard
          title="Monthly production report"
          detail={productionDetail}
          label="Month"
          type="month"
          value={productionMonth}
          onChange={setProductionMonth}
          busy={busy === "monthly-production"}
          disabled={!productionMonth || busy !== null}
          onDownload={() => void downloadProduction("monthly")}
        />
        <ReportCard
          title="Daily attendance report"
          detail="Present, absent, leave, half day, and holiday, with check-in, check-out, leave type, and source for each person."
          label="Date"
          type="date"
          value={attendanceDay}
          onChange={setAttendanceDay}
          busy={busy === "daily-attendance"}
          disabled={!attendanceDay || busy !== null}
          onDownload={() => void downloadAttendance("daily")}
        />
        <ReportCard
          title="Monthly attendance report"
          detail="The same attendance detail for every day in the month, plus a total for each person."
          label="Month"
          type="month"
          value={attendanceMonth}
          onChange={setAttendanceMonth}
          busy={busy === "monthly-attendance"}
          disabled={!attendanceMonth || busy !== null}
          onDownload={() => void downloadAttendance("monthly")}
        />
      </div>

      {admin ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-ink">Email recipients</h2>
          <p className="mt-1 text-sm text-slate-600">
            These addresses receive the scheduled reports. The downloads above do not need a recipient.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block space-y-1.5 text-[13px] font-medium text-slate-700">
              Report
              <select
                className="block rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
              >
                <option value="shift_production">Shift production</option>
                <option value="monthly_production">Monthly production</option>
                <option value="daily_delivery">Daily delivery</option>
                <option value="monthly_attendance">Monthly attendance</option>
              </select>
            </label>
            <div className="min-w-[240px] flex-1">
              <TextField
                label="Emails"
                placeholder="name@company.com, other@company.com"
                value={emails}
                onChange={(event) => setEmails(event.target.value)}
              />
            </div>
            <PrimaryButton type="button" onClick={() => void saveRecipients()}>
              Save
            </PrimaryButton>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {recipients.length === 0 ? (
              <li className="text-slate-500">No recipient lists saved yet.</li>
            ) : (
              recipients.map((row) => (
                <li key={row._id || row.reportType} className="rounded-xl border border-line px-3 py-2">
                  <p className="font-medium text-ink">
                    {RECIPIENT_LABELS[row.reportType || ""] || row.reportType || "Report"}
                    {row.enabled === false ? " (paused)" : ""}
                  </p>
                  <p className="mt-0.5 text-slate-600">
                    {row.emails?.length ? row.emails.join(", ") : "No emails"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReportCard({
  title,
  detail,
  label,
  type,
  value,
  onChange,
  busy,
  disabled,
  onDownload,
}: {
  title: string;
  detail: string;
  label: string;
  type: "date" | "month";
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  onDownload: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
      </div>
      <TextField
        label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <PrimaryButton
        type="button"
        className="inline-flex items-center justify-center gap-2 self-start"
        disabled={disabled}
        onClick={onDownload}
      >
        <FileDown className="h-4 w-4" strokeWidth={1.75} />
        {busy ? "Preparing PDF…" : "Download PDF"}
      </PrimaryButton>
    </Card>
  );
}

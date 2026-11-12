"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminAttendance,
  getWarehouseProfiles,
  type AttendanceRecord,
} from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import {
  attendanceRecordUserId,
  stlAttendanceLoginId,
  stlHrPeopleForAttendance,
  warehouseStaffLabel,
} from "@/lib/hr-scope";
import { warehouseField } from "@/lib/profiles";
import {
  getHrStaff,
  getAttendanceOverrides,
  getHrStaffAttendance,
  markHrStaffAttendance,
  overrideSalesAttendance,
  type HrStaff,
  type HrStaffAttendanceMark,
} from "@/lib/stl-features-api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { attendanceDatesInRange, attendanceMarkSpan, attendanceSaveStatus } from "@/lib/attendance-bulk";
import { MarkAttendanceDialog } from "@/components/MarkAttendanceDialog";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

type HrPerson = {
  key: string;
  name: string;
  email?: string;
  roleLabel: string;
  loginId: string;
  kind: "staff" | "user";
};

function dubaiDayKey(value?: string | Date) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

function dubaiToday() {
  return dubaiDayKey(new Date());
}

function markStatusLabel(mark: HrStaffAttendanceMark) {
  if (mark.status === "present") return "Present";
  if (mark.status === "absent") return "Absent";
  if (mark.status === "holiday") return "Holiday";
  return mark.leaveType === "sick" ? "Sick leave" : "Annual leave";
}

function markTarget(person: HrPerson) {
  if (person.loginId) return `portal:${person.loginId}`;
  if (person.kind === "staff") return `staff:${person.key}`;
  return "";
}

function fmtDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function roleLabel(row: HrStaff, managerIds: Set<string>) {
  const loginId = stlAttendanceLoginId(row);
  if (row.kind === "staff" && row.role !== "Warehouse") {
    return row.role && row.role !== "Staff" ? row.role : "Staff";
  }
  return warehouseStaffLabel(managerIds.has(loginId));
}

export default function AdminAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [staffMarks, setStaffMarks] = useState<HrStaffAttendanceMark[]>([]);
  const [overrides, setOverrides] = useState<
    Array<{ salesId: string; date: string; status: string }>
  >([]);
  const [todayOnly, setTodayOnly] = useState(true);
  const [markOpen, setMarkOpen] = useState(false);
  const [savingMark, setSavingMark] = useState(false);
  const [markPerson, setMarkPerson] = useState("");
  const [markStatus, setMarkStatus] = useState("present");
  const [markLeaveType, setMarkLeaveType] = useState<"annual" | "sick">("annual");
  const [markReason, setMarkReason] = useState("");
  const [markDate, setMarkDate] = useState(dubaiToday);
  const [markEndDate, setMarkEndDate] = useState(dubaiToday);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin(user)) {
      router.replace("/admin");
    }
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.id || !isSuperAdmin(user)) return;
    setLoading(true);
    setError(null);
    try {
      const to = dubaiToday();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      const from = todayOnly
        ? to
        : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(fromDate);
      const [hr, warehouse, data, marks, overrideData] = await Promise.all([
        getHrStaff(user.id, { role: "Warehouse", scope: "stl" }),
        getWarehouseProfiles().catch(() => []),
        getAdminAttendance(
          todayOnly
            ? { userId: user.id, today: true }
            : { userId: user.id, from, to },
        ),
        getHrStaffAttendance(user.id, "stl", from, to).catch(() => ({
          marks: [] as HrStaffAttendanceMark[],
        })),
        getAttendanceOverrides(user.id, from, to).catch(() => ({ overrides: [] })),
      ]);
      const managerIds = new Set(
        warehouse
          .filter((row) => warehouseField(row).isSuperManager)
          .map((row) => row._id),
      );
      const roster = stlHrPeopleForAttendance(hr.staff || []);
      const loginIds = new Set(
        roster.map((row) => stlAttendanceLoginId(row)).filter(Boolean),
      );
      setPeople(
        roster
          .map((row): HrPerson => ({
            key: row.id,
            name: row.name || "Unnamed",
            email: row.email,
            roleLabel: roleLabel(row, managerIds),
            loginId: stlAttendanceLoginId(row),
            kind: row.kind === "staff" ? "staff" : "user",
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setRecords(
        (data.attendance || []).filter((row) =>
          loginIds.has(attendanceRecordUserId(row.sales)),
        ),
      );
      setStaffMarks(marks.marks || []);
      setOverrides(
        (overrideData.overrides || []).map((row) => ({
          salesId:
            row.sales && typeof row.sales === "object"
              ? String(row.sales._id || "")
              : String(row.sales || ""),
          date: dubaiDayKey(row.date),
          status: String(row.status || ""),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [user, todayOnly]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const cards = useMemo(() => {
    const byLogin = new Map<string, AttendanceRecord[]>();
    for (const row of records) {
      const id = attendanceRecordUserId(row.sales);
      if (!id) continue;
      const list = byLogin.get(id) || [];
      list.push(row);
      byLogin.set(id, list);
    }

    if (todayOnly) {
      return people.map((person) => {
        const record = person.loginId
          ? byLogin.get(person.loginId)?.[0]
          : undefined;
        const marked = staffMarks
          .filter((mark) => mark.staffId === person.key)
          .map((mark) => markStatusLabel(mark))
          .join(", ");
        const override = overrides.find(
          (row) => row.salesId === person.loginId && row.date === dubaiToday(),
        );
        const overrideLabel =
          override?.status === "present"
            ? "Present"
            : override?.status === "absent"
              ? "Absent"
              : override?.status === "holiday"
                ? "Holiday"
                : "";
        return {
          key: person.key,
          name: person.name,
          email: person.email,
          roleLabel: person.roleLabel,
          checkInAt: record?.checkInAt,
          checkOutAt: record?.checkOutAt,
          report: record?.report,
          empty: overrideLabel
            ? overrideLabel
            : record
              ? undefined
              : marked || (person.loginId ? "Not checked in" : "Not marked"),
        };
      });
    }

    const seen = new Set<string>();
    const fromRecords = records.map((row) => {
      const loginId = attendanceRecordUserId(row.sales);
      seen.add(loginId);
      const person = people.find((item) => item.loginId === loginId);
      const populated = row.sales && typeof row.sales === "object" ? row.sales : null;
      return {
        key: row._id,
        name: person?.name || populated?.name || populated?.email || "Staff",
        email: person?.email || populated?.email,
        roleLabel: person?.roleLabel || "Staff",
        checkInAt: row.checkInAt,
        checkOutAt: row.checkOutAt,
        report: row.report,
        empty: undefined as string | undefined,
      };
    });
    const missing = people
      .filter((person) => !person.loginId || !seen.has(person.loginId))
      .map((person) => {
        const marked = [
          ...staffMarks
            .filter((mark) => mark.staffId === person.key)
            .map((mark) => `${mark.date}: ${markStatusLabel(mark)}`),
          ...overrides
            .filter((row) => row.salesId === person.loginId)
            .map((row) => `${row.date}: ${row.status}`),
        ].join(", ");
        return {
          key: person.key,
          name: person.name,
          email: person.email,
          roleLabel: person.roleLabel,
          checkInAt: undefined as string | undefined,
          checkOutAt: undefined as string | undefined,
          report: undefined as string | undefined,
          empty: marked || (person.loginId ? "No check-in recorded" : "Not marked"),
        };
      });
    return [...fromRecords, ...missing];
  }, [overrides, people, records, staffMarks, todayOnly]);

  const markPeople = useMemo(
    () =>
      people
        .map((person) => ({
          id: markTarget(person),
          label: `${person.name} (${person.roleLabel})`,
        }))
        .filter((person) => person.id),
    [people],
  );

  function openMark(person?: HrPerson) {
    setMarkPerson(person ? markTarget(person) : "");
    setMarkStatus("present");
    setMarkLeaveType("annual");
    setMarkReason("");
    setMarkDate(dubaiToday());
    setMarkEndDate(dubaiToday());
    setMarkOpen(true);
  }

  function closeMark() {
    if (savingMark) return;
    setMarkOpen(false);
    setMarkReason("");
  }

  async function onMark(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !markPerson) {
      toast("Choose a person", "info");
      return;
    }
    const [kind, id] = markPerson.split(":");
    const saved = attendanceSaveStatus(markStatus);
    const status = saved.status;
    const dates = attendanceMarkSpan(markStatus)
      ? attendanceDatesInRange(markDate, markEndDate || markDate)
      : [markDate];
    if (!dates) {
      toast("Choose a valid holiday range", "info");
      return;
    }
    setSavingMark(true);
    try {
      for (const date of dates) {
        if (kind === "staff") {
          await markHrStaffAttendance(user.id, id, {
            date,
            status,
            ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
            reason: markReason.trim(),
          });
        } else {
          await overrideSalesAttendance({
            userId: user.id,
            salesId: id,
            date,
            status,
            ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
            reason: markReason.trim() || undefined,
          });
        }
      }
      toast("Attendance saved", "success");
      setMarkOpen(false);
      setMarkReason("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Attendance save failed", "error");
    } finally {
      setSavingMark(false);
    }
  }

  if (authLoading || !isSuperAdmin(user)) {
    return <LoadingState label="Checking access…" />;
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Check-in, check-out, and manual attendance for everyone listed in HR."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" disabled={loading || people.length === 0} onClick={() => openMark()}>
              Mark attendance
            </SecondaryButton>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTodayOnly(true)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            todayOnly ? "bg-brand text-black" : "bg-white border border-line"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setTodayOnly(false)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            !todayOnly ? "bg-brand text-black" : "bg-white border border-line"
          }`}
        >
          All recent
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : people.length === 0 ? (
        <EmptyState title="No one in HR" />
      ) : (
        <div className="space-y-2">
          {cards.map((row) => (
            <Card key={row.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-slate-900">{row.name}</p>
                <button
                  type="button"
                  className="shrink-0 font-medium text-brand-dark underline"
                  onClick={() => {
                    const person = people.find((item) => item.key === row.key || item.name === row.name);
                    if (person) openMark(person);
                  }}
                >
                  Edit
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {row.roleLabel}
                {row.email ? ` · ${row.email}` : ""}
              </p>
              {row.empty ? (
                <p className="mt-2 text-sm text-slate-700">{row.empty}</p>
              ) : (
                <>
                  <p className="mt-2 text-sm font-medium text-slate-800">Present</p>
                  <p className="mt-1 text-sm text-slate-700">
                    Check in: {fmtDateTime(row.checkInAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Check out: {fmtDateTime(row.checkOutAt)}
                  </p>
                  {row.report ? (
                    <p className="mt-2 text-sm text-slate-700">Report: {row.report}</p>
                  ) : null}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
      <MarkAttendanceDialog
        open={markOpen}
        description="Record present, absent, annual or sick leave, or a holiday range. Reason is optional."
        people={markPeople}
        person={markPerson}
        date={markDate}
        endDate={markEndDate}
        status={markStatus}
        leaveType={markLeaveType}
        reason={markReason}
        saving={savingMark}
        statusOptions={[
          { value: "present", label: "Present" },
          { value: "absent", label: "Absent" },
          { value: "leave", label: "Annual leave" },
          { value: "sick", label: "Sick leave" },
          { value: "holiday", label: "Holiday" },
        ]}
        onClose={closeMark}
        onPerson={setMarkPerson}
        onDate={(value) => {
          setMarkDate(value);
          if (markEndDate < value) setMarkEndDate(value);
        }}
        onEndDate={setMarkEndDate}
        onStatus={setMarkStatus}
        onLeaveType={setMarkLeaveType}
        onReason={setMarkReason}
        onSubmit={onMark}
      />
    </div>
  );
}

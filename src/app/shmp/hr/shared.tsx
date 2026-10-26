"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminAttendance, getAdminLeaves } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import {
  shmpAttendance,
  shmpEmployeeLeaveBalance,
  type ShmpAccessRole,
  type ShmpAccessUser,
  type ShmpAttendanceRow,
  type ShmpPresentTodayRow,
  type ShmpWorkerShift,
} from "@/lib/shmp-api";

export type LeaveBalance = {
  year?: number;
  entitlement?: number;
  used?: number;
  remaining?: number;
  sickEntitlement?: number;
  sickUsed?: number;
  sickRemaining?: number;
};

export type Emp = {
  _id: string;
  name: string;
  designation?: string;
  company?: string;
  biometricId?: string;
  salary?: { basic?: number };
  annualLeaveEntitlement?: number;
  sickLeaveEntitlement?: number;
  defaultShift?: ShmpWorkerShift;
  visa?: { number?: string; expiry?: string; yearsWorked?: number };
  leave?: LeaveBalance;
  mobileNumber?: string;
  email?: string;
  employeeCode?: string;
  isActive?: boolean;
};

export const DESIGNATIONS = [
  "Operator",
  "Helper",
  "Supervisor",
  "Staff",
  "Other",
] as const;

export type Designation = (typeof DESIGNATIONS)[number];

export type DayFilter = "total" | "present" | "absent" | "leave";

export type HistoryRange = "1m" | "3m" | "6m" | "ytd";

export const HISTORY_RANGES: Array<{ id: HistoryRange; label: string }> = [
  { id: "1m", label: "Last month" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "ytd", label: "Year to date" },
];

export function companyOf(emp: Emp | undefined) {
  if (!emp?.company) return "";
  return String(emp.company);
}

export function capitalize(value: string | undefined) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function attendanceEmployeeId(row: ShmpAttendanceRow): string {
  const emp = row.employee;
  if (emp) {
    return typeof emp === "object" ? String(emp._id || "") : String(emp);
  }
  const user = row.user;
  if (!user) return "";
  return typeof user === "object" ? String(user._id || "") : String(user);
}

export function attendanceEmployeeName(row: ShmpAttendanceRow): string {
  const emp = row.employee;
  if (emp && typeof emp === "object" && emp.name) return emp.name;
  const user = row.user;
  if (user && typeof user === "object" && user.name) return user.name;
  return "Staff";
}

export function badgeStatusFor(
  status: string | undefined,
): "present" | "absent" | "leave" {
  if (status === "present" || status === "half_day" || status === "checked_out") {
    return "present";
  }
  if (status === "leave") return "leave";
  return "absent";
}

export function StatusBadge({
  status,
}: {
  status: "present" | "absent" | "leave";
}) {
  const styles =
    status === "present"
      ? "bg-green-100 text-green-800"
      : status === "leave"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  const label =
    status === "present" ? "Present" : status === "leave" ? "Leave" : "Absent";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

export function formatCheckIn(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function formatDay(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function searchHaystack(parts: Array<string | undefined | null>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesQuery(term: string, parts: Array<string | undefined | null>) {
  if (!term) return true;
  return searchHaystack(parts).includes(term);
}

export function historyRangeBounds(range: HistoryRange): { from: string; to: string } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  if (range === "ytd") {
    from.setMonth(0, 1);
  } else {
    const months = range === "1m" ? 1 : range === "3m" ? 3 : 6;
    from.setMonth(from.getMonth() - months);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function unwrapEmployee(data: unknown): Emp | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row._id === "string") return row as unknown as Emp;
  const nested = row.employee;
  if (nested && typeof nested === "object" && "_id" in nested) {
    return nested as Emp;
  }
  return null;
}

export function unwrapAccessUser(data: unknown): ShmpAccessUser | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row._id === "string") return row as unknown as ShmpAccessUser;
  const nested = row.user;
  if (nested && typeof nested === "object" && "_id" in nested) {
    return nested as ShmpAccessUser;
  }
  return null;
}

export function usersVisibleToSupervisor(list: ShmpAccessUser[]) {
  return list.filter((u) => u.role === "Supervisor");
}

export function trackedAccessRole(role?: string): role is ShmpAccessRole {
  return role === "Sales" || role === "Supervisor";
}

type HistoryRow = {
  id: string;
  date: string;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  leaveType?: string;
};

function asHistoryRow(row: ShmpAttendanceRow, index: number): HistoryRow {
  const date =
    row.date ||
    row.checkInAt ||
    row.checkOutAt ||
    "";
  return {
    id: String(row._id || `${date}-${index}`),
    date: String(date),
    status: String(row.status || (row.checkInAt ? "present" : "—")),
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    leaveType: row.leaveType,
  };
}

export function AttendanceHistory({
  kind,
  personId,
}: {
  kind: "worker" | "portal";
  personId: string;
}) {
  const { user } = useAuth();
  const [range, setRange] = useState<HistoryRange>("1m");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [leaveNotes, setLeaveNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => historyRangeBounds(range), [range]);

  const load = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    setError(null);
    try {
      if (kind === "worker") {
        const att = await shmpAttendance({
          mine: "0",
          employeeId: personId,
          from: bounds.from,
          to: bounds.to,
        });
        const list = Array.isArray(att) ? att : [];
        const mine = list.filter((row) => attendanceEmployeeId(row) === personId);
        setRows(
          (mine.length ? mine : list).map(asHistoryRow).sort((a, b) =>
            String(b.date).localeCompare(String(a.date)),
          ),
        );
        setLeaveNotes([]);
      } else {
        const [portalAtt, adminAtt, leaves] = await Promise.all([
          shmpAttendance({
            mine: "0",
            userId: personId,
            from: bounds.from,
            to: bounds.to,
          }).catch(() => [] as ShmpAttendanceRow[]),
          user?.id
            ? getAdminAttendance({
                userId: user.id,
                salesId: personId,
                from: bounds.from.slice(0, 10),
                to: bounds.to.slice(0, 10),
              }).catch(() => ({ attendance: [] }))
            : Promise.resolve({ attendance: [] }),
          getAdminLeaves({
            salesId: personId,
            from: bounds.from.slice(0, 10),
            to: bounds.to.slice(0, 10),
          }).catch(() => ({ leaves: [] })),
        ]);
        const fromPortal = (Array.isArray(portalAtt) ? portalAtt : [])
          .filter((row) => {
            const id = attendanceEmployeeId(row);
            return !id || id === personId;
          })
          .map(asHistoryRow);
        const fromAdmin = (adminAtt.attendance || []).map((row, index) => ({
          id: row._id || `admin-${index}`,
          date: row.date || row.checkInAt || "",
          status: row.checkInAt ? "present" : "absent",
          checkInAt: row.checkInAt,
          checkOutAt: row.checkOutAt,
        }));
        const merged = new Map<string, HistoryRow>();
        for (const row of [...fromPortal, ...fromAdmin]) {
          const key = `${String(row.date).slice(0, 10)}-${row.status}-${row.checkInAt || ""}`;
          if (!merged.has(key)) merged.set(key, row);
        }
        setRows(
          [...merged.values()].sort((a, b) =>
            String(b.date).localeCompare(String(a.date)),
          ),
        );
        setLeaveNotes(
          (leaves.leaves || []).map((leave) => {
            const start = String(leave.startDate || "").slice(0, 10);
            const end = String(leave.endDate || "").slice(0, 10);
            const type = leave.leaveType || "leave";
            return `${start}${end && end !== start ? ` → ${end}` : ""} · ${type} · ${leave.status}${
              leave.reason ? ` · ${leave.reason}` : ""
            }`;
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [bounds.from, bounds.to, kind, personId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">Attendance history</h2>
          <p className="mt-1 text-xs text-slate-500">
            Check-ins and leave for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {HISTORY_RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                range === item.id
                  ? "bg-brand text-black"
                  : "border border-line bg-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading history…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : rows.length === 0 && leaveNotes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No attendance recorded in this period.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {leaveNotes.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Leave requests
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {leaveNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <ul className="divide-y divide-line/60 text-sm">
              {rows.map((row) => {
                const inTime = formatCheckIn(row.checkInAt);
                const outTime = formatCheckIn(row.checkOutAt);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="font-medium text-ink">{formatDay(row.date)}</p>
                      <p className="text-xs text-slate-500">
                        {inTime ? `In ${inTime}` : "No check-in"}
                        {outTime ? ` · Out ${outTime}` : ""}
                        {row.leaveType ? ` · ${row.leaveType}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={badgeStatusFor(row.status)} />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function leaveLabel(emp: Emp) {
  const annualRemaining = emp.leave?.remaining ?? "—";
  const annualTotal =
    emp.leave?.entitlement ?? emp.annualLeaveEntitlement ?? "—";
  const sickRemaining = emp.leave?.sickRemaining ?? "—";
  const sickTotal =
    emp.leave?.sickEntitlement ?? emp.sickLeaveEntitlement ?? "—";
  return {
    annual: `${annualRemaining}/${annualTotal}`,
    sick: `${sickRemaining}/${sickTotal}`,
  };
}

export function readLeaveBalance(raw: Record<string, unknown> | null | undefined): LeaveBalance {
  if (!raw) return {};
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    year: num(raw.year),
    entitlement: num(raw.entitlement ?? raw.annualLeaveEntitlement),
    used: num(raw.used ?? raw.annualUsed),
    remaining: num(raw.remaining ?? raw.annualRemaining),
    sickEntitlement: num(raw.sickEntitlement ?? raw.sickLeaveEntitlement),
    sickUsed: num(raw.sickUsed),
    sickRemaining: num(raw.sickRemaining),
  };
}

export async function loadWorkerLeave(id: string): Promise<LeaveBalance> {
  try {
    const raw = await shmpEmployeeLeaveBalance(id);
    return readLeaveBalance(raw);
  } catch {
    return {};
  }
}

export function personHref(
  kind: "user" | "worker",
  id: string,
  edit = false,
) {
  const path = kind === "user" ? `/shmp/hr/user/${id}` : `/shmp/hr/worker/${id}`;
  return edit ? `${path}?edit=1` : path;
}

export function resolvePresentTarget(
  row: ShmpPresentTodayRow,
  users: ShmpAccessUser[],
  employees: Emp[],
): { kind: "user" | "worker"; id: string } {
  const name = (row.name || "").trim().toLowerCase();
  if (row.kind === "worker") {
    const emp =
      employees.find((e) => e._id === row._id) ||
      employees.find((e) => (e.name || "").trim().toLowerCase() === name);
    return { kind: "worker", id: emp?._id || row._id };
  }
  const user =
    users.find((u) => u._id === row._id) ||
    users.find(
      (u) =>
        (u.name || "").trim().toLowerCase() === name &&
        (!row.role || (u.role || "") === row.role),
    ) ||
    users.find((u) => (u.name || "").trim().toLowerCase() === name);
  return { kind: "user", id: user?._id || row._id };
}

export function presentHref(
  row: ShmpPresentTodayRow,
  users: ShmpAccessUser[],
  employees: Emp[],
) {
  const target = resolvePresentTarget(row, users, employees);
  return personHref(target.kind, target.id);
}

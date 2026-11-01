"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getHrStaff, type HrStaff } from "@/lib/stl-features-api";
import { useAuth } from "@/components/AuthProvider";
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
};

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<HrPerson[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [todayOnly, setTodayOnly] = useState(true);

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
      const [hr, warehouse, data] = await Promise.all([
        getHrStaff(user.id, { role: "Warehouse", scope: "stl" }),
        getWarehouseProfiles().catch(() => []),
        getAdminAttendance({
          userId: user.id,
          today: todayOnly,
        }),
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
          .map((row) => ({
            key: row.id,
            name: row.name || "Unnamed",
            email: row.email,
            roleLabel: roleLabel(row, managerIds),
            loginId: stlAttendanceLoginId(row),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setRecords(
        (data.attendance || []).filter((row) =>
          loginIds.has(attendanceRecordUserId(row.sales)),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [user, todayOnly]);

  useEffect(() => {
    void load();
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
        return {
          key: person.key,
          name: person.name,
          email: person.email,
          roleLabel: person.roleLabel,
          checkInAt: record?.checkInAt,
          checkOutAt: record?.checkOutAt,
          report: record?.report,
          empty: person.loginId
            ? record
              ? undefined
              : "Not checked in"
            : "No portal login",
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
      .map((person) => ({
        key: person.key,
        name: person.name,
        email: person.email,
        roleLabel: person.roleLabel,
        checkInAt: undefined as string | undefined,
        checkOutAt: undefined as string | undefined,
        report: undefined as string | undefined,
        empty: person.loginId ? "No check-in recorded" : "No portal login",
      }));
    return [...fromRecords, ...missing];
  }, [people, records, todayOnly]);

  if (authLoading || !isSuperAdmin(user)) {
    return <LoadingState label="Checking access…" />;
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Check-in and check-out for everyone listed in HR."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
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
              <p className="font-semibold text-slate-900">{row.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.roleLabel}
                {row.email ? ` · ${row.email}` : ""}
              </p>
              {row.empty ? (
                <p className="mt-2 text-sm text-slate-700">{row.empty}</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-700">
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
    </div>
  );
}

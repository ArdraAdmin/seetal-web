"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminAttendance,
  getWarehouseProfiles,
  type AttendanceRecord,
} from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { attendanceRecordUserId } from "@/lib/hr-scope";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";

function fmtDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function staffName(row: AttendanceRecord) {
  if (row.sales && typeof row.sales === "object") {
    return row.sales.name || row.sales.email || "Warehouse staff";
  }
  return "Warehouse staff";
}

export default function AdminAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const [data, warehouse] = await Promise.all([
        getAdminAttendance({
          userId: user.id,
          today: todayOnly,
        }),
        getWarehouseProfiles().catch(() => []),
      ]);
      const warehouseIds = new Set(warehouse.map((row) => row._id));
      setRecords(
        (data.attendance || []).filter((row) =>
          warehouseIds.has(attendanceRecordUserId(row.sales)),
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

  if (authLoading || !isSuperAdmin(user)) {
    return <LoadingState label="Checking access…" />;
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Warehouse user and warehouse manager check-in and check-out times (super admin only)."
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
      ) : records.length === 0 ? (
        <EmptyState title="No attendance records" />
      ) : (
        <div className="space-y-2">
          {records.map((row) => (
            <Card key={row._id} className="p-4">
              <p className="font-semibold text-slate-900">{staffName(row)}</p>
              <p className="mt-2 text-sm text-slate-700">
                Check in: {fmtDateTime(row.checkInAt)}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Check out: {fmtDateTime(row.checkOutAt)}
              </p>
              {row.report ? (
                <p className="mt-2 text-sm text-slate-700">
                  Report: {row.report}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

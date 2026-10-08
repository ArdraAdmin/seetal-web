"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSalesAttendanceToday,
  salesCheckIn,
  salesCheckOut,
  type AttendanceRecord,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import {
  ensureLocationEnabled,
  getCurrentPosition,
  startLocationHeartbeat,
  stopLocationHeartbeat,
} from "@/lib/sales-location";

function fmtTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function SalesAttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSalesAttendanceToday(user.id);
      setAttendance(data.attendance);
      setCheckedIn(!!data.checkedIn);
      setCheckedOut(!!data.checkedOut);
      if (data.checkedIn) {
        await startLocationHeartbeat(user.id);
      } else {
        stopLocationHeartbeat();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCheckIn() {
    if (!user?.id || busy) return;
    const ok = await ensureLocationEnabled();
    if (!ok) {
      toast("Turn on location to check in", "info");
      return;
    }
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      await salesCheckIn({
        userId: user.id,
        lat: pos?.lat,
        lng: pos?.lng,
        accuracy: pos?.accuracy,
      });
      await startLocationHeartbeat(user.id);
      toast("Checked in successfully", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Check-in failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckOut() {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      await salesCheckOut({
        userId: user.id,
        lat: pos?.lat,
        lng: pos?.lng,
        accuracy: pos?.accuracy,
      });
      stopLocationHeartbeat();
      toast("Checked out successfully", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Check-out failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Check in at the start of your day and check out when finished."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <Card className="max-w-lg p-5">
          <p className="text-sm text-slate-500">Today</p>
          <p className="mt-3 text-sm text-slate-800">
            Check in: <strong>{fmtTime(attendance?.checkInAt)}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-800">
            Check out: <strong>{fmtTime(attendance?.checkOutAt)}</strong>
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            Status:{" "}
            {checkedOut
              ? "Checked out"
              : checkedIn
                ? "Checked in"
                : "Not checked in"}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <PrimaryButton
              type="button"
              disabled={busy || checkedIn || checkedOut}
              onClick={() => void onCheckIn()}
            >
              Check In
            </PrimaryButton>
            <SecondaryButton
              type="button"
              disabled={busy || !checkedIn || checkedOut}
              onClick={() => void onCheckOut()}
            >
              Check Out
            </SecondaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}

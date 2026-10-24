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
  const [busyLabel, setBusyLabel] = useState("Working…");
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [report, setReport] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSalesAttendanceToday(user.id);
      setAttendance(data.attendance);
      setCheckedIn(!!data.checkedIn);
      setCheckedOut(!!data.checkedOut);
      if (data.checkedIn && !data.checkedOut) {
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
    setBusy(true);
    setBusyLabel("Getting location…");
    try {
      const ok = await ensureLocationEnabled();
      if (!ok) {
        toast("Turn on location to check in", "info");
        return;
      }
      setBusyLabel("Checking in…");
      const pos = await getCurrentPosition();
      await salesCheckIn({
        userId: user.id,
        lat: pos?.lat,
        lng: pos?.lng,
        accuracy: pos?.accuracy,
      });
      await startLocationHeartbeat(user.id);
      toast("Checked in successfully", "success");
      window.dispatchEvent(new Event("stl-sales-attendance-changed"));
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Check-in failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onCheckOut() {
    if (!user?.id || busy) return;
    const trimmed = report.trim();
    if (!trimmed) {
      toast("Enter today's report before checking out", "info");
      return;
    }
    setBusy(true);
    setBusyLabel("Getting location…");
    try {
      const pos = await getCurrentPosition();
      setBusyLabel("Checking out…");
      await salesCheckOut({
        userId: user.id,
        lat: pos?.lat,
        lng: pos?.lng,
        accuracy: pos?.accuracy,
        report: trimmed,
      });
      stopLocationHeartbeat();
      setShowCheckoutForm(false);
      setReport("");
      toast("Checked out successfully", "success");
      window.dispatchEvent(new Event("stl-sales-attendance-changed"));
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Check-out failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const mustCheckIn = !checkedIn && !checkedOut;

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle={
          mustCheckIn
            ? "Check in to start your day before using the sales app."
            : "Check in at the start of your day and check out when finished."
        }
        actions={
          mustCheckIn ? null : (
            <SecondaryButton
              type="button"
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </SecondaryButton>
          )
        }
      />

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : mustCheckIn ? (
        <Card className="mx-auto max-w-lg p-6 text-center">
          <p className="text-sm text-slate-600">
            You must check in before placing orders or opening stores.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Location access is required for check-in.
          </p>
          <div className="mt-6 flex justify-center">
            <PrimaryButton
              type="button"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void onCheckIn()}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {busyLabel}
                </span>
              ) : (
                "Check In"
              )}
            </PrimaryButton>
          </div>
        </Card>
      ) : (
        <Card className="max-w-lg p-5">
          <p className="text-sm text-slate-500">Today</p>
          <p className="mt-3 text-sm text-slate-800">
            Check in: <strong>{fmtTime(attendance?.checkInAt)}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-800">
            Check out: <strong>{fmtTime(attendance?.checkOutAt)}</strong>
          </p>
          {attendance?.report ? (
            <p className="mt-2 text-sm text-slate-800">
              Report: <strong>{attendance.report}</strong>
            </p>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-slate-900">
            Status:{" "}
            {checkedOut
              ? "Checked out"
              : checkedIn
                ? "Checked in"
                : "Not checked in"}
          </p>

          {showCheckoutForm && checkedIn && !checkedOut ? (
            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                Today&apos;s report
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={5}
                  placeholder="Summarize what you did today…"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand"
                  disabled={busy}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton
                  type="button"
                  disabled={busy || !report.trim()}
                  aria-busy={busy}
                  onClick={() => void onCheckOut()}
                >
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {busyLabel}
                    </span>
                  ) : (
                    "Submit & Check Out"
                  )}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowCheckoutForm(false);
                    setReport("");
                  }}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <PrimaryButton
                type="button"
                disabled={busy || checkedIn || checkedOut}
                aria-busy={busy}
                onClick={() => void onCheckIn()}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {busyLabel}
                  </span>
                ) : (
                  "Check In"
                )}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={busy || !checkedIn || checkedOut}
                onClick={() => setShowCheckoutForm(true)}
              >
                Check Out
              </SecondaryButton>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

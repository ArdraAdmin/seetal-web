"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  getSalesAttendanceToday,
  getSalesLeave,
  salesCheckIn,
  salesCheckOut,
  type AttendanceRecord,
} from "@/lib/api";
import { SalesAccountTabs, fmtDubai } from "@/components/StlFeatureUi";
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
  captureCheckInLocation,
  getCurrentPosition,
  startLocationHeartbeat,
  stopLocationHeartbeat,
} from "@/lib/sales-location";

type LeaveBalance = NonNullable<
  Awaited<ReturnType<typeof getSalesLeave>>["balance"]
>;

function fmtTime(value?: string) {
  return fmtDubai(value);
}

function BusyLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </span>
  );
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
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [report, setReport] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [data, leave] = await Promise.all([
        getSalesAttendanceToday(user.id),
        getSalesLeave(user.id).catch(() => null),
      ]);
      setBalance(leave?.balance ?? null);
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
      const captured = await captureCheckInLocation();
      if (captured.blocked) {
        toast(captured.message ?? "Turn on location to check in", "info");
        return;
      }
      setBusyLabel("Checking in…");
      const pos = captured.position;
      await salesCheckIn({
        userId: user.id,
        lat: pos?.lat,
        lng: pos?.lng,
        accuracy: pos?.accuracy,
      });
      await startLocationHeartbeat(user.id);
      toast(
        pos
          ? "Checked in successfully"
          : "Checked in. Location was not available, so tracking will start when it is.",
        "success",
      );
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
            ? "Check in to start your day before using the sales app. Times shown in Dubai (GST)."
            : "Check in when you start and check out when finished. Times shown in Dubai (GST)."
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

      <SalesAccountTabs />

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
          <Card className={mustCheckIn ? "p-6 text-center" : "p-5"}>
            {mustCheckIn ? (
              <>
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
                    {busy ? <BusyLabel label={busyLabel} /> : "Check In"}
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
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
                  <div className="mt-5 space-y-3 text-left">
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
                          <BusyLabel label={busyLabel} />
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
                      {busy ? <BusyLabel label={busyLabel} /> : "Check In"}
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
              </>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-slate-500">
                Leave balance{balance ? ` (${balance.year})` : ""}
              </p>
              <Link
                href="/sales/leave"
                className="text-sm font-medium text-brand-dark underline"
              >
                Manage leave
              </Link>
            </div>
            {balance ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line p-3">
                  <p className="text-xs text-slate-500 uppercase">Annual left</p>
                  <p className="mt-1 text-xl font-semibold text-ink">
                    {balance.remaining.annual}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      / {balance.entitlements.annual}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Pending {balance.pending.annual}d
                  </p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <p className="text-xs text-slate-500 uppercase">Sick left</p>
                  <p className="mt-1 text-xl font-semibold text-ink">
                    {balance.remaining.sick}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      / {balance.entitlements.sick}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Pending {balance.pending.sick}d
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Balance unavailable.</p>
            )}
            <Link
              href="/sales/leave"
              className="mt-4 inline-block rounded-lg border border-line px-3 py-2 text-sm hover:bg-[#f7f5f0]"
            >
              Apply for leave
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}

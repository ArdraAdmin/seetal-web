"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSalesAttendanceToday,
  salesCheckIn,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { LoadingState, PrimaryButton } from "@/components/ui";
import {
  captureCheckInLocation,
  startLocationHeartbeat,
} from "@/lib/sales-location";

type Props = {
  /** When true, require GPS (Sales). Supervisors check in without location. */
  requireLocation?: boolean;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Blocks Sales / Supervisor portal access until they check in for the day.
 * Admins are never gated. After check-in (or if already checked out), children render.
 */
export function StaffCheckInGate({
  requireLocation = false,
  title = "Check in to start your day",
  subtitle = "Tap check in to record attendance and open the portal.",
  children,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    // Admins are not tracked.
    if (user.role === "Admin") {
      setNeedsCheckIn(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSalesAttendanceToday(user.id);
      const attended =
        !!data.checkedIn ||
        !!data.checkedOut ||
        !!data.attendance?.checkInAt;
      setNeedsCheckIn(!attended);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
      setNeedsCheckIn(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCheckIn() {
    if (!user?.id || busy) return;
    setBusy(true);
    setError(null);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;
      if (requireLocation) {
        const captured = await captureCheckInLocation();
        if (captured.blocked) {
          const message = captured.message ?? "Turn on location to check in";
          setError(message);
          toast(message, "info");
          return;
        }
        lat = captured.position?.lat;
        lng = captured.position?.lng;
        accuracy = captured.position?.accuracy;
      }
      await salesCheckIn({
        userId: user.id,
        lat,
        lng,
        accuracy,
      });
      if (requireLocation) {
        void startLocationHeartbeat(user.id);
      }
      toast(
        lat != null
          ? "Checked in successfully"
          : "Checked in. Location was not available, so tracking will start when it is.",
        "success",
      );
      setNeedsCheckIn(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Check-in failed";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking attendance…" />
      </div>
    );
  }

  if (!needsCheckIn) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_24px_60px_-28px_rgba(14,58,50,0.35)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-dark">
          Attendance
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <PrimaryButton
          type="button"
          className="mt-6 w-full"
          disabled={busy}
          onClick={() => void onCheckIn()}
        >
          {busy ? "Checking in…" : "Check in"}
        </PrimaryButton>
        <button
          type="button"
          className="mt-3 w-full text-sm text-slate-500 underline"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}

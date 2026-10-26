"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  applySalesLeave,
  cancelSalesLeave,
  getSalesLeave,
  type LeaveRequestRow,
} from "@/lib/api";
import { SalesAccountTabs, SelectField } from "@/components/StlFeatureUi";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

function fmtDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

type LeaveBalance = NonNullable<
  Awaited<ReturnType<typeof getSalesLeave>>["balance"]
>;

export default function SalesLeavePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [leaves, setLeaves] = useState<LeaveRequestRow[]>([]);
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState<"annual" | "sick">("annual");
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSalesLeave(user.id, status || undefined);
      setApprovedCount(data.approvedCount || 0);
      setPendingCount(data.pendingCount || 0);
      setLeaves(data.leaves || []);
      setBalance(data.balance ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave");
    } finally {
      setLoading(false);
    }
  }, [user?.id, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApply(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !startDate) {
      toast("Pick a start date", "info");
      return;
    }
    setBusy(true);
    try {
      await applySalesLeave({
        userId: user.id,
        startDate,
        endDate: endDate || startDate,
        reason,
        leaveType,
      });
      toast("Leave request submitted", "success");
      setStartDate("");
      setEndDate("");
      setReason("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to apply", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(leaveId: string) {
    if (!user?.id) return;
    setBusy(true);
    try {
      await cancelSalesLeave(user.id, leaveId);
      toast("Leave cancelled", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Cancel failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Apply for leave, cancel pending requests, and view history."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      <SalesAccountTabs />

      {balance ? (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Annual leave remaining ({balance.year})
            </p>
            <p className="text-2xl font-semibold text-ink">
              {balance.remaining.annual}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {balance.entitlements.annual} days
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Used {balance.used.annual}d · Pending {balance.pending.annual}d
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-slate-500">
              Sick leave remaining ({balance.year})
            </p>
            <p className="text-2xl font-semibold text-ink">
              {balance.remaining.sick}{" "}
              <span className="text-sm font-normal text-slate-500">
                / {balance.entitlements.sick} days
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Used {balance.used.sick}d · Pending {balance.pending.sick}d
            </p>
          </Card>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="text-2xl font-semibold text-emerald-700">{approvedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="text-2xl font-semibold text-amber-700">{pendingCount}</p>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <h3 className="mb-3 font-semibold">Apply for leave</h3>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onApply}>
          <label className="text-sm">
            Start date
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            End date (optional)
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <SelectField
              label="Leave type"
              value={leaveType}
              onChange={(e) =>
                setLeaveType(e.target.value === "sick" ? "sick" : "annual")
              }
            >
              <option value="annual">
                Annual{balance ? ` (${balance.remaining.annual} left)` : ""}
              </option>
              <option value="sick">
                Sick{balance ? ` (${balance.remaining.sick} left)` : ""}
              </option>
            </SelectField>
          </div>
          <label className="text-sm sm:col-span-2">
            Reason (optional)
            <input
              className="mt-1 w-full rounded-xl border border-line px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={busy}>
              Submit request
            </PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="mb-3">
        <label className="text-sm">
          Filter status
          <select
            className="mt-1 w-full max-w-xs rounded-xl border border-line bg-white px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingState label="Loading leave…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : leaves.length === 0 ? (
        <EmptyState title="No leave requests" />
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <Card key={leave._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)}
                  </p>
                  <p className="text-sm text-slate-500">
                    <span className="capitalize">
                      {leave.leaveType || "annual"}
                    </span>{" "}
                    · {leave.dayCount} day(s) · {leave.status}
                  </p>
                  {leave.reason ? (
                    <p className="mt-1 text-sm text-slate-600">{leave.reason}</p>
                  ) : null}
                </div>
                {leave.status === "pending" ? (
                  <SecondaryButton
                    type="button"
                    disabled={busy}
                    onClick={() => void onCancel(leave._id)}
                  >
                    Cancel
                  </SecondaryButton>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

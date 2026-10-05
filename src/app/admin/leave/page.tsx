"use client";

import { useCallback, useEffect, useState } from "react";
import {
  decideAdminLeave,
  getAdminLeaves,
  type LeaveRequestRow,
} from "@/lib/api";
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

function salesName(leave: LeaveRequestRow) {
  if (leave.sales && typeof leave.sales === "object") {
    return leave.sales.name || leave.sales.email || "Sales";
  }
  return "Sales";
}

export default function AdminLeavePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequestRow[]>([]);
  const [status, setStatus] = useState("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminLeaves({
        status: status || undefined,
      });
      setLeaves(data.leaves || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDecide(leaveId: string, decision: "approved" | "rejected") {
    setBusyId(leaveId);
    try {
      await decideAdminLeave(leaveId, decision, user?.id);
      toast(`Leave ${decision}`, "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Decision failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave management"
        subtitle="Review salesman leave requests. Approve or reject pending items."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

      <div className="mb-4">
        <label className="text-sm">
          Status
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
        <LoadingState label="Loading leave requests…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : leaves.length === 0 ? (
        <EmptyState title="No leave requests" />
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <Card key={leave._id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{salesName(leave)}</p>
                  <p className="text-sm text-slate-600">
                    {fmtDate(leave.startDate)} → {fmtDate(leave.endDate)} ·{" "}
                    {leave.dayCount} day(s)
                  </p>
                  {leave.reason ? (
                    <p className="mt-1 text-sm text-slate-500">{leave.reason}</p>
                  ) : null}
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {leave.status}
                  </p>
                </div>
                {leave.status === "pending" ? (
                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      disabled={busyId === leave._id}
                      onClick={() => void onDecide(leave._id, "rejected")}
                    >
                      Reject
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      disabled={busyId === leave._id}
                      onClick={() => void onDecide(leave._id, "approved")}
                    >
                      Approve
                    </PrimaryButton>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

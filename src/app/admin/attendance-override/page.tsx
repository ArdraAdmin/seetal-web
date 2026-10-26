"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { SelectField, fmtDateOnly, useDubaiNow } from "@/components/StlFeatureUi";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { getAdminPerformance } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import {
  getAttendanceOverrides,
  overrideSalesAttendance,
} from "@/lib/stl-features-api";

type Salesman = { id: string; name: string; email?: string };

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return str(o.name ?? o.email ?? o._id ?? "");
  }
  return "";
}

export default function AdminAttendanceOverridePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const dubai = useDubaiNow();
  const allowed = isSuperAdmin(user);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [overrides, setOverrides] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [salesId, setSalesId] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"present" | "absent">("present");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDate((v) => v || dubai.isoDate);
  }, [dubai.isoDate]);

  const load = useCallback(async () => {
    if (!user?.id || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const [perf, ov] = await Promise.all([
        getAdminPerformance(),
        getAttendanceOverrides(user.id).catch(() => ({ overrides: [] })),
      ]);
      setSalesmen(
        perf.salesmen.map((s) => ({
          id: s.sales._id,
          name: s.sales.name || s.sales.email || s.sales._id,
          email: s.sales.email,
        })),
      );
      setOverrides(ov.overrides || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user?.id, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !salesId || !date) {
      toast("Pick a salesman and date", "info");
      return;
    }
    setBusy(true);
    try {
      await overrideSalesAttendance({
        userId: user.id,
        salesId,
        date,
        status,
        reason: reason.trim() || undefined,
      });
      toast("Attendance override saved", "success");
      setReason("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Override failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Attendance override" />
        <EmptyState
          title="Super admin only"
          description="You do not have permission to override attendance."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance override"
        subtitle="Mark a salesman present or absent for a specific day (Dubai date)."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />
      {loading && salesmen.length === 0 ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <Card className="max-w-xl">
            <form className="space-y-3" onSubmit={onSubmit}>
              <SelectField
                label="Salesman"
                required
                value={salesId}
                onChange={(e) => setSalesId(e.target.value)}
              >
                <option value="">Select salesman…</option>
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.email ? ` (${s.email})` : ""}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value === "absent" ? "absent" : "present")
                }
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </SelectField>
              <TextField
                label="Reason"
                optional
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <PrimaryButton type="submit" disabled={busy}>
                Save override
              </PrimaryButton>
            </form>
          </Card>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Recent overrides</h2>
            {overrides.length === 0 ? (
              <EmptyState title="No overrides yet" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-2">Salesman</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {overrides.map((raw, i) => {
                      const o = raw as Record<string, unknown>;
                      const sid = str(o.sales ?? o.salesId);
                      const name =
                        salesmen.find((s) => s.id === sid)?.name || str(o.sales) || sid;
                      return (
                        <tr key={str(o._id) || i}>
                          <td className="px-4 py-2">{name || "-"}</td>
                          <td className="px-4 py-2">{fmtDateOnly(str(o.date))}</td>
                          <td className="px-4 py-2 capitalize">{str(o.status) || "-"}</td>
                          <td className="px-4 py-2">{str(o.reason) || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

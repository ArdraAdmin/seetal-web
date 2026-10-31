"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HrUserDocuments } from "@/components/HrStaffEditor";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import {
  addHrIncrement,
  getHrStaffMember,
  type HrStaff,
} from "@/lib/stl-features-api";

export default function AdminHrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [incAmount, setIncAmount] = useState("");
  const [incDate, setIncDate] = useState("");
  const [incNotes, setIncNotes] = useState("");
  const [incSetBasic, setIncSetBasic] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await getHrStaffMember(user.id, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onIncrement(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    const amount = Number(incAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("Enter an increment amount", "info");
      return;
    }
    setBusy(true);
    try {
      await addHrIncrement(user.id, id, {
        amount,
        effectiveDate: incDate || undefined,
        notes: incNotes.trim() || undefined,
        setAsBasic: incSetBasic,
      });
      toast("Increment added", "success");
      setIncAmount("");
      setIncDate("");
      setIncNotes("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add increment", "error");
    } finally {
      setBusy(false);
    }
  }

  const increments = [...(staff?.hrProfile?.salaryIncrements ?? [])].sort((a, b) =>
    String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
  );

  return (
    <div>
      <PageHeader
        title={staff?.name || "Staff HR"}
        subtitle={staff ? `${staff.email} · ${staff.role}` : undefined}
        actions={
          <Link
            href="/admin/hr"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
          >
            Back to HR
          </Link>
        }
      />
      {loading && !staff ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <HrUserDocuments personId={id} showCompany />
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Add salary increment</h2>
              <p className="mb-3 text-xs text-slate-500">
                Joined {fmtDateOnly(staff?.joiningDate)}
                {staff?.yearsOfService != null ? ` · ${staff.yearsOfService} years of service` : ""}
              </p>
              <form className="space-y-3" onSubmit={onIncrement}>
                <TextField label="Amount (AED)" type="number" min={0} step="0.01" required value={incAmount} onChange={(event) => setIncAmount(event.target.value)} />
                <TextField label="Effective date" type="date" optional value={incDate} onChange={(event) => setIncDate(event.target.value)} />
                <TextField label="Notes" optional value={incNotes} onChange={(event) => setIncNotes(event.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={incSetBasic} onChange={(event) => setIncSetBasic(event.target.checked)} />
                  Set as new basic salary
                </label>
                <SecondaryButton type="submit" disabled={busy}>Add increment</SecondaryButton>
              </form>
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Increment history</h2>
              {increments.length === 0 ? (
                <p className="text-sm text-slate-500">No increments recorded.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {increments.map((inc, index) => (
                    <li key={`${inc.effectiveDate}-${index}`} className="flex items-start justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">{fmtDateOnly(inc.effectiveDate)}</p>
                        {inc.notes ? <p className="text-xs text-slate-500">{inc.notes}</p> : null}
                      </div>
                      <span className="font-medium">{salesMoney(inc.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import {
  addHrIncrement,
  getHrStaffMember,
  updateHrStaff,
  type HrStaff,
} from "@/lib/stl-features-api";

type Form = {
  visaApplicationYear: string;
  visaCost: string;
  visaNumber: string;
  visaDetails: string;
  visaExpiry: string;
  basicSalary: string;
  company: string;
};

function toForm(s: HrStaff): Form {
  const p = s.hrProfile || {};
  return {
    visaApplicationYear: p.visaApplicationYear != null ? String(p.visaApplicationYear) : "",
    visaCost: p.visaCost != null ? String(p.visaCost) : "",
    visaNumber: p.visaNumber || "",
    visaDetails: p.visaDetails || "",
    visaExpiry: p.visaExpiry ? fmtDateOnly(p.visaExpiry) : "",
    basicSalary: p.basicSalary != null ? String(p.basicSalary) : "",
    company: p.company || "",
  };
}

export default function AdminHrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [form, setForm] = useState<Form | null>(null);
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
      const s = await getHrStaffMember(user.id, id);
      setStaff(s);
      setForm(toForm(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !form) return;
    setBusy(true);
    try {
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      await updateHrStaff(user.id, id, {
        visaApplicationYear: num(form.visaApplicationYear),
        visaCost: num(form.visaCost),
        visaNumber: form.visaNumber,
        visaDetails: form.visaDetails,
        visaExpiry: form.visaExpiry || undefined,
        basicSalary: num(form.basicSalary),
        company: form.company,
      });
      toast("HR profile saved", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onIncrement(e: FormEvent) {
    e.preventDefault();
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
      ) : staff && form ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">HR profile</h2>
            <p className="mb-3 text-xs text-slate-500">
              Joined {fmtDateOnly(staff.joiningDate)}
              {staff.yearsOfService != null ? ` · ${staff.yearsOfService} years of service` : ""}
            </p>
            <form className="space-y-3" onSubmit={onSave}>
              <TextField label="Company" optional value={form.company} onChange={(e) => set("company", e.target.value)} />
              <TextField label="Basic salary (AED)" type="number" min={0} step="0.01" optional value={form.basicSalary} onChange={(e) => set("basicSalary", e.target.value)} />
              <TextField label="Visa number" optional value={form.visaNumber} onChange={(e) => set("visaNumber", e.target.value)} />
              <TextField label="Visa expiry" type="date" optional value={form.visaExpiry} onChange={(e) => set("visaExpiry", e.target.value)} />
              <TextField label="Visa application year" type="number" optional value={form.visaApplicationYear} onChange={(e) => set("visaApplicationYear", e.target.value)} />
              <TextField label="Visa cost (AED)" type="number" min={0} step="0.01" optional value={form.visaCost} onChange={(e) => set("visaCost", e.target.value)} />
              <TextField label="Visa details" optional value={form.visaDetails} onChange={(e) => set("visaDetails", e.target.value)} />
              <PrimaryButton type="submit" disabled={busy}>
                Save profile
              </PrimaryButton>
            </form>
          </Card>

          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Add salary increment</h2>
              <form className="space-y-3" onSubmit={onIncrement}>
                <TextField label="Amount (AED)" type="number" min={0} step="0.01" required value={incAmount} onChange={(e) => setIncAmount(e.target.value)} />
                <TextField label="Effective date" type="date" optional value={incDate} onChange={(e) => setIncDate(e.target.value)} />
                <TextField label="Notes" optional value={incNotes} onChange={(e) => setIncNotes(e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={incSetBasic} onChange={(e) => setIncSetBasic(e.target.checked)} />
                  Set as new basic salary
                </label>
                <SecondaryButton type="submit" disabled={busy}>
                  Add increment
                </SecondaryButton>
              </form>
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Increment history</h2>
              {increments.length === 0 ? (
                <p className="text-sm text-slate-500">No increments recorded.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {increments.map((inc, i) => (
                    <li key={`${inc.effectiveDate}-${i}`} className="flex items-start justify-between gap-2 py-2">
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
      ) : null}
    </div>
  );
}

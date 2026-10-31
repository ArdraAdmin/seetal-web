"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { HrProfileFields } from "@/components/HrProfileFields";
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
import {
  emptyHrProfileForm,
  hrProfilePayload,
  hrProfileToForm,
  toDateInput,
  validateHrProfileForm,
  type HrProfileFormState,
} from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import {
  addHrStaffIncrement,
  createHrStaff,
  getEmployeeHr,
  getHrLinkCandidates,
  getHrStaffMember,
  getHrStaffRecord,
  updateEmployeeHr,
  updateHrStaff,
  updateHrStaffRecord,
  uploadHrFile,
  type HrStaff,
} from "@/lib/stl-features-api";

export function HrStaffEditor({ scope }: { scope: "stl" | "shmp" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const id = String(params.id || "");
  const creating = id === "new";
  const listHref = scope === "stl" ? "/admin/hr" : "/shmp/hr";
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [form, setForm] = useState<HrProfileFormState>(emptyHrProfileForm);
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [linkedUserId, setLinkedUserId] = useState("");
  const [candidates, setCandidates] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [loading, setLoading] = useState(!creating);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || creating) return;
    setLoading(true);
    setError(null);
    try {
      const record = await getHrStaffRecord(user.id, id);
      setStaff(record);
      setForm(hrProfileToForm(record.hrProfile, record.name));
      setEmail(record.email || "");
      setMobile(record.mobileNumber || "");
      setJoiningDate(toDateInput(record.joiningDate));
      setLinkedUserId(record.linkedUserId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user, creating, id]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void getHrLinkCandidates(user.id, scope, creating ? undefined : id)
      .then((result) => {
        if (!cancelled) setCandidates(result.users || []);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, scope, creating, id]);

  async function onUpload(file: File) {
    if (!user?.id) throw new Error("Sign in again");
    return uploadHrFile(user.id, file);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    const problem = validateHrProfileForm(form);
    if (problem) {
      toast(problem, "info");
      return;
    }
    setBusy(true);
    try {
      const hrProfile = hrProfilePayload(form);
      if (creating) {
        const created = await createHrStaff(user.id, {
          scope,
          email: email.trim(),
          mobileNumber: mobile.trim(),
          joiningDate: joiningDate || undefined,
          linkedUserId: linkedUserId || undefined,
          hrProfile,
        });
        toast("Staff record added", "success");
        router.replace(scope === "stl" ? `/admin/hr/staff/${created.id}` : `/shmp/hr/staff/${created.id}`);
        return;
      }
      await updateHrStaffRecord(user.id, id, {
        hrProfile,
        email: email.trim(),
        mobileNumber: mobile.trim(),
        joiningDate,
        linkedUserId: linkedUserId || null,
        enforceDocuments: true,
      });
      toast("Staff record saved", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const linkOptions = [...candidates];
  if (linkedUserId && !linkOptions.some((row) => row.id === linkedUserId)) {
    linkOptions.unshift({
      id: linkedUserId,
      name: staff?.name || "Linked login",
      email: staff?.email || "",
      role: staff?.role || "",
    });
  }

  return (
    <div>
      <PageHeader
        title={creating ? "Add staff" : staff?.name || "Staff"}
        subtitle={creating ? "A person who does not need a login. You can link a login later." : staff?.email || undefined}
        actions={
          <Link href={listHref} className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]">
            Back to HR
          </Link>
        }
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <form className="space-y-4" onSubmit={onSave}>
          <Card>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <TextField label="Email" type="email" optional value={email} onChange={(event) => setEmail(event.target.value)} />
              <TextField label="Mobile" optional value={mobile} onChange={(event) => setMobile(event.target.value)} />
              <TextField label="Joined" type="date" optional value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} />
              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium text-slate-700">Linked login</span>
                <select
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  value={linkedUserId}
                  onChange={(event) => setLinkedUserId(event.target.value)}
                >
                  <option value="">No login linked</option>
                  {linkOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.email} · {row.role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <HrProfileFields
              form={form}
              onChange={setForm}
              disabled={busy}
              onUpload={onUpload}
              showCompany={scope === "stl"}
            />
            <div className="mt-4">
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "Saving…" : creating ? "Add staff" : "Save record"}
              </PrimaryButton>
            </div>
          </Card>
        </form>
      )}
      {!creating && staff && user?.id ? (
        <IncrementCard
          staff={staff}
          onAdded={load}
          add={(payload) => addHrStaffIncrement(user.id, id, payload)}
        />
      ) : null}
    </div>
  );
}

export function HrUserDocuments({
  personId,
  showCompany = false,
}: {
  personId: string;
  showCompany?: boolean;
}) {
  return (
    <RecordDocuments
      personId={personId}
      showCompany={showCompany}
      loadRecord={getHrStaffMember}
      saveRecord={(adminId, recordId, hrProfile) =>
        updateHrStaff(adminId, recordId, hrProfile, { enforceDocuments: true })
      }
    />
  );
}

export function HrEmployeeDocuments({ personId }: { personId: string }) {
  return (
    <RecordDocuments
      personId={personId}
      loadRecord={getEmployeeHr}
      saveRecord={updateEmployeeHr}
    />
  );
}

function RecordDocuments({
  personId,
  showCompany = false,
  loadRecord,
  saveRecord,
}: {
  personId: string;
  showCompany?: boolean;
  loadRecord: (adminId: string, id: string) => Promise<HrStaff>;
  saveRecord: (
    adminId: string,
    id: string,
    hrProfile: Record<string, unknown>,
  ) => Promise<HrStaff>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<HrProfileFormState>(emptyHrProfileForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id || !personId) return;
    setLoading(true);
    setError(null);
    try {
      const record = await loadRecord(user.id, personId);
      setForm(hrProfileToForm(record.hrProfile, record.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HR record");
    } finally {
      setLoading(false);
    }
  }, [user, personId, loadRecord]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    const problem = validateHrProfileForm(form);
    if (problem) {
      toast(problem, "info");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveRecord(user.id, personId, hrProfilePayload(form));
      setForm(hrProfileToForm(saved.hrProfile, saved.name));
      toast("HR record saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading HR record…" />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-ink">Employment record</h2>
      <HrProfileFields
        form={form}
        onChange={setForm}
        disabled={busy}
        showCompany={showCompany}
        onUpload={(file) => {
          if (!user?.id) return Promise.reject(new Error("Sign in again"));
          return uploadHrFile(user.id, file);
        }}
      />
      <div className="mt-4">
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save employment record"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function IncrementCard({
  staff,
  onAdded,
  add,
}: {
  staff: HrStaff;
  onAdded: () => Promise<void>;
  add: (payload: {
    amount: number;
    effectiveDate?: string;
    notes?: string;
    setAsBasic?: boolean;
  }) => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [setBasic, setSetBasic] = useState(true);
  const [busy, setBusy] = useState(false);
  const increments = [...(staff.hrProfile?.salaryIncrements ?? [])].sort((a, b) =>
    String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast("Enter an increment amount", "info");
      return;
    }
    setBusy(true);
    try {
      await add({
        amount: value,
        effectiveDate: date || undefined,
        notes: notes.trim() || undefined,
        setAsBasic: setBasic,
      });
      toast("Increment added", "success");
      setAmount("");
      setDate("");
      setNotes("");
      await onAdded();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add increment", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Add salary increment</h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <TextField label="Amount (AED)" type="number" min={0} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          <TextField label="Effective date" type="date" optional value={date} onChange={(event) => setDate(event.target.value)} />
          <TextField label="Notes" optional value={notes} onChange={(event) => setNotes(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={setBasic} onChange={(event) => setSetBasic(event.target.checked)} />
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
  );
}

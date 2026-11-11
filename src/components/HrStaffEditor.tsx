"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { HrProfileFields, type HrFieldVisibility } from "@/components/HrProfileFields";
import { portalFieldVisible, type CustomAccess, type PortalSide } from "@/lib/custom-users";
import { SearchableSelect } from "@/components/SearchableSelect";
import { HrLedgerCard } from "@/components/HrLedgerCard";
import { SalaryIncrementCard } from "@/components/SalaryIncrementCard";
import { SalarySlipCard } from "@/components/SalarySlipCard";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  TextField,
} from "@/components/ui";
import {
  emptyHrProfileForm,
  hrProfilePayload,
  hrProfileToForm,
  joiningDateError,
  toDateInput,
  validateHrProfileForm,
  type HrProfileFormState,
} from "@/lib/hr-profile";
import {
  addHrStaffIncrement,
  createHrStaff,
  deleteHrStaff,
  deleteHrStaffIncrement,
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

function hrFieldsFor(
  access: CustomAccess | null | undefined,
  portal: PortalSide,
): HrFieldVisibility {
  const on = (fieldId: string) => portalFieldVisible(access, portal, "hr", fieldId);
  return {
    salary: on("salary"),
    passport: on("passport"),
    eid: on("eid"),
    visa: on("visa"),
    insurance: on("insurance"),
  };
}

export function HrStaffEditor({ scope }: { scope: "stl" | "shmp" }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const shown = hrFieldsFor(user?.customAccess, scope === "stl" ? "selling" : "shmp");
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
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || creating) return;
    setLoading(true);
    setError(null);
    try {
      const record = await getHrStaffRecord(user.id, id);
      setStaff(record);
      setForm(hrProfileToForm(record.hrProfile, record.name, scope));
      setEmail(record.email || "");
      setMobile(record.mobileNumber || "");
      setJoiningDate(toDateInput(record.joiningDate));
      setLinkedUserId(record.linkedUserId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user, creating, id, scope]);

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
    const joinedProblem = joiningDateError(joiningDate);
    if (joinedProblem) {
      toast(joinedProblem, "info");
      return;
    }
    const problem = validateHrProfileForm(form, scope, shown, {
      requireCompany: scope === "stl",
    });
    if (problem) {
      toast(problem, "info");
      return;
    }
    setBusy(true);
    try {
      const hrProfile = hrProfilePayload(form, scope);
      if (creating) {
        const created = await createHrStaff(user.id, {
          scope,
          email: email.trim(),
          mobileNumber: mobile.trim(),
          joiningDate,
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

  async function onDelete() {
    if (!user?.id || creating || !staff) return;
    if (!confirm(`Remove ${staff.name} from staff?`)) return;
    setRemoving(true);
    try {
      await deleteHrStaff(user.id, id);
      toast("Staff record removed", "success");
      router.push(listHref);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
      setRemoving(false);
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
              <TextField label="Joined" type="date" required value={joiningDate} onChange={(event) => setJoiningDate(event.target.value)} />
              <SearchableSelect
                label="Linked login"
                optional
                value={linkedUserId}
                onChange={setLinkedUserId}
                placeholder="Search scoped users"
                emptyOption={{ id: "", label: "No login linked" }}
                options={linkOptions.map((row) => ({
                  id: row.id,
                  label: [row.name, row.email, row.role].filter(Boolean).join(" · "),
                  searchText: `${row.name} ${row.email} ${row.role}`,
                }))}
              />
            </div>
            <HrProfileFields
              form={form}
              onChange={setForm}
              disabled={busy || removing}
              onUpload={onUpload}
              showCompany={scope === "stl"}
              scope={scope}
              shown={shown}
              showProductionWorker={scope === "shmp"}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <PrimaryButton type="submit" disabled={busy || removing}>
                {busy ? "Saving…" : creating ? "Add staff" : "Save record"}
              </PrimaryButton>
              {!creating ? (
                <button
                  type="button"
                  className="font-medium text-red-700 underline disabled:opacity-50"
                  disabled={busy || removing}
                  onClick={() => void onDelete()}
                >
                  {removing ? "Removing…" : "Delete staff"}
                </button>
              ) : null}
            </div>
          </Card>
        </form>
      )}
      {!creating && staff && scope === "shmp" && shown.salary ? (
        <div className="mt-4">
          <HrLedgerCard staff={staff} onChanged={load} />
        </div>
      ) : null}
      {!creating && staff && user?.id && shown.salary ? (
        <SalaryIncrementCard
          staff={staff}
          scope={scope}
          onChanged={load}
          add={(payload) => addHrStaffIncrement(user.id, id, { ...payload, scope })}
          remove={(entryId) => deleteHrStaffIncrement(user.id, id, entryId)}
        />
      ) : null}
      {!creating && staff && shown.salary ? <SalarySlipCard kind="staff" personId={id} /> : null}
    </div>
  );
}

export function HrUserDocuments({
  personId,
  showCompany = false,
  scope,
  reloadKey = 0,
}: {
  personId: string;
  showCompany?: boolean;
  scope: "stl" | "shmp";
  reloadKey?: number;
}) {
  return (
    <RecordDocuments
      personId={personId}
      showCompany={showCompany}
      scope={scope}
      reloadKey={reloadKey}
      loadRecord={getHrStaffMember}
      saveRecord={(adminId, recordId, hrProfile) =>
        updateHrStaff(adminId, recordId, hrProfile, { enforceDocuments: true, scope })
      }
    />
  );
}

export function HrEmployeeDocuments({ personId }: { personId: string }) {
  return (
    <RecordDocuments
      personId={personId}
      scope="shmp"
      loadRecord={getEmployeeHr}
      saveRecord={updateEmployeeHr}
    />
  );
}

function RecordDocuments({
  personId,
  showCompany = false,
  scope,
  reloadKey = 0,
  loadRecord,
  saveRecord,
}: {
  personId: string;
  showCompany?: boolean;
  scope: "stl" | "shmp";
  reloadKey?: number;
  loadRecord: (adminId: string, id: string) => Promise<HrStaff>;
  saveRecord: (
    adminId: string,
    id: string,
    hrProfile: Record<string, unknown>,
  ) => Promise<HrStaff>;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const shown = hrFieldsFor(user?.customAccess, scope === "stl" ? "selling" : "shmp");
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
      setForm(hrProfileToForm(record.hrProfile, record.name, scope));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HR record");
    } finally {
      setLoading(false);
    }
  }, [user, personId, loadRecord, scope, reloadKey]);

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
    const problem = validateHrProfileForm(form, scope, shown, {
      requireCompany: showCompany,
    });
    if (problem) {
      toast(problem, "info");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveRecord(user.id, personId, hrProfilePayload(form, scope));
      setForm(hrProfileToForm(saved.hrProfile, saved.name, scope));
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
        scope={scope}
        shown={shown}
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getCompanies } from "@/lib/api";
import { deleteHrStaff, getHrStaff, uploadHrFile, type HrStaff } from "@/lib/stl-features-api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  emptySharjahPermit,
  saveSharjahPermit,
  type SharjahPermitState,
} from "@/lib/sharjah-permit";
import { useAuth } from "@/components/AuthProvider";
import { SharjahPermitFields } from "@/components/HrProfileFields";
import { portalFieldVisible } from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import { isSupervisor } from "@/lib/auth";
import { VISA_ALERT_DAYS, isExpiringWithinDays } from "@/lib/expiry-window";
import { addedHrStaffOnly } from "@/lib/hr-scope";
import {
  shmpCreateAccessUser,
  shmpCreateAccessWorker,
  shmpEmployees,
  type ShmpAccessRole,
  type ShmpWorkerShift,
} from "@/lib/shmp-api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { companyOf, personHref, type Emp } from "./shared";

const SHMP_USER_ROLES: ShmpAccessRole[] = ["Supervisor", "Sales"];

type DialogMode = "Worker" | ShmpAccessRole;

type HrRow = {
  id: string;
  kind: "staff";
  name: string;
  email?: string;
  role: string;
  joiningDate?: string | null;
  yearsOfService?: number | null;
  visaExpiry?: string;
};

function visaSoon(expiry?: string) {
  return isExpiringWithinDays(expiry, VISA_ALERT_DAYS);
}

function staffRole(row: HrStaff) {
  if (row.linkedUserId && row.role && row.role !== "Staff") return row.role;
  return "Staff";
}

export default function ShmpHrPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const supervisor = isSupervisor(user);
  const show = (fieldId: string) =>
    portalFieldVisible(user?.customAccess, "shmp", "hr", fieldId);
  const [staff, setStaff] = useState<HrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRole, setDialogRole] = useState<DialogMode | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userYearsWorked, setUserYearsWorked] = useState("");
  const [userVisaExpiry, setUserVisaExpiry] = useState("");
  const [userShift, setUserShift] = useState<ShmpWorkerShift>("morning");
  const [userBiometricId, setUserBiometricId] = useState("");
  const [permit, setPermit] = useState<SharjahPermitState>(emptySharjahPermit);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const hr = await getHrStaff(user.id, { scope: "shmp" });
      const rows: HrRow[] = addedHrStaffOnly(hr.staff || [])
        .map((row) => ({
          id: row.id,
          kind: "staff" as const,
          name: row.hrProfile?.visaName || row.name,
          email: row.email,
          role: staffRole(row),
          joiningDate: row.joiningDate,
          yearsOfService: row.yearsOfService,
          visaExpiry: row.hrProfile?.visaExpiry,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setStaff(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = q.trim().toLowerCase();
  const rows = term
    ? staff.filter((s) =>
        `${s.name} ${s.email || ""} ${s.role}`.toLowerCase().includes(term),
      )
    : staff;

  const dialogRoles = useMemo<DialogMode[]>(
    () => (supervisor ? [] : ["Worker", ...SHMP_USER_ROLES]),
    [supervisor],
  );

  function resetDialog() {
    setDialogOpen(false);
    setDialogRole(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserMobile("");
    setUserYearsWorked("");
    setUserVisaExpiry("");
    setUserShift("morning");
    setUserBiometricId("");
    setPermit(emptySharjahPermit());
  }

  async function onCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!dialogRole || supervisor) {
      toast("Only admins can create users", "info");
      return;
    }
    const yearsWorked =
      userYearsWorked.trim() === "" ? undefined : Number(userYearsWorked);
    if (
      yearsWorked !== undefined &&
      (!Number.isFinite(yearsWorked) || yearsWorked < 0)
    ) {
      toast("Years worked must be a non-negative number", "info");
      return;
    }
    if (dialogRole === "Worker") {
      if (!userName.trim()) {
        toast("Name is required", "info");
        return;
      }
      setCreating(true);
      setError(null);
      try {
        let company = "";
        try {
          const companies = await getCompanies();
          company = resolveSalesCompanyByKey("shmp", companies)?.id || "";
        } catch {
          // fall back to an existing worker's company below
        }
        if (!company) {
          const workers = (await shmpEmployees().catch(() => [])) as Emp[];
          company = companyOf(Array.isArray(workers) ? workers[0] : undefined);
        }
        if (!company) {
          throw new Error("Could not determine SHMP company for this worker");
        }
        const visa: { yearsWorked?: number; expiry?: string } = {};
        if (yearsWorked !== undefined) visa.yearsWorked = yearsWorked;
        if (userVisaExpiry) visa.expiry = userVisaExpiry;
        await shmpCreateAccessWorker({
          name: userName.trim(),
          company,
          designation: "Operator",
          defaultShift: userShift,
          biometricId: userBiometricId.trim() || undefined,
          email: userEmail.trim() || undefined,
          mobileNumber: userMobile.trim() || undefined,
          visa: Object.keys(visa).length ? visa : undefined,
        });
        toast("Worker created", "success");
        resetDialog();
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        setError(message);
        toast(message, "error");
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      toast("Name, email, and password are required", "info");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await shmpCreateAccessUser({
        role: dialogRole,
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword.trim(),
        mobileNumber: userMobile.trim() || undefined,
        ...(dialogRole === "Sales" ? { environments: ["stl", "shmp"] } : {}),
      });
      if ((permit.expiry || permit.file) && created?._id && user?.id) {
        try {
          await saveSharjahPermit({
            adminUserId: user.id,
            personId: created._id,
            scope: "shmp",
            permit,
            fallbackName: userName.trim(),
          });
        } catch (permitError) {
          toast(
            permitError instanceof Error
              ? `${permitError.message} The user was created, but the Sharjah permit was not saved.`
              : "The user was created, but the Sharjah permit was not saved.",
            "error",
          );
        }
      }
      toast(`${dialogRole} user created`, "success");
      resetDialog();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toast(message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteStaff(row: HrRow) {
    if (row.kind !== "staff" || !user?.id) return;
    if (!confirm(`Remove ${row.name} from staff?`)) return;
    setDeletingId(row.id);
    try {
      await deleteHrStaff(user.id, row.id);
      toast("Staff record removed", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="HR"
        subtitle="Joined date, years of service, and visa expiry for staff you add here."
        actions={
          <div className="flex flex-wrap gap-2">
            {!supervisor ? (
              <PrimaryButton type="button" onClick={() => setDialogOpen(true)}>
                Add user
              </PrimaryButton>
            ) : null}
            {!supervisor ? (
              <SecondaryButton type="button" onClick={() => router.push("/shmp/hr/staff/new")}>
                Add staff
              </SecondaryButton>
            ) : null}
            {!supervisor && show("salary") ? (
              <SecondaryButton type="button" onClick={() => router.push("/shmp/hr/payroll")}>
                Payroll settings
              </SecondaryButton>
            ) : null}
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />
      <div className="mb-4 max-w-sm">
        <TextField
          label="Search"
          placeholder="Name, email or role"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={staff.length === 0 ? "No staff yet" : "No matching staff"}
          description={
            staff.length === 0
              ? "Add a staff member to show their joined date, years of service, and visa expiry."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Years</th>
                {show("visa") ? <th className="px-4 py-2">Visa expiry</th> : null}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={`${s.kind}-${s.id}`}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.email || "—"}</p>
                  </td>
                  <td className="px-4 py-2">{s.role}</td>
                  <td className="px-4 py-2">{fmtDateOnly(s.joiningDate)}</td>
                  <td className="px-4 py-2 text-right">{s.yearsOfService ?? "-"}</td>
                  {show("visa") ? (
                  <td
                    className={`px-4 py-2 ${visaSoon(s.visaExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {fmtDateOnly(s.visaExpiry)}
                  </td>
                  ) : null}
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={personHref(s.kind, s.id)}
                        className="font-medium text-brand-dark underline"
                      >
                        Edit
                      </Link>
                      {s.kind === "staff" && !supervisor ? (
                        <button
                          type="button"
                          className="font-medium text-red-700 underline disabled:opacity-50"
                          disabled={deletingId === s.id}
                          onClick={() => void onDeleteStaff(s)}
                        >
                          {deletingId === s.id ? "Removing…" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetDialog();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg">
            {!dialogRole ? (
              <>
                <h2 id="add-user-title" className="text-lg font-semibold text-ink">
                  Create user
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sales, supervisor, or factory worker. Admin accounts are not managed here.
                </p>
                <div className="mt-4 grid gap-2">
                  {dialogRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDialogRole(role)}
                      className="rounded-xl border border-line px-4 py-3 text-left text-sm font-medium hover:border-brand hover:bg-brand/15"
                    >
                      {role}
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {role === "Worker"
                          ? "Factory employee — attendance via fingerprint (no portal login)"
                          : role === "Supervisor"
                            ? "SHMP manufacturing oversight — daily check-in required"
                            : "Shared with STL — place orders, daily check-in required"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Cancel
                  </SecondaryButton>
                </div>
              </>
            ) : (
              <form onSubmit={onCreateUser} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id="add-user-title" className="text-lg font-semibold text-ink">
                      New {dialogRole}
                    </h2>
                    <button
                      type="button"
                      className="mt-1 text-xs text-slate-600 underline"
                      onClick={() => setDialogRole(null)}
                    >
                      Change type
                    </button>
                  </div>
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Close
                  </SecondaryButton>
                </div>
                <TextField
                  label="Name"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                {dialogRole === "Worker" ? (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-medium text-slate-700">
                        Shift
                      </span>
                      <select
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        value={userShift}
                        onChange={(e) =>
                          setUserShift(e.target.value as ShmpWorkerShift)
                        }
                      >
                        <option value="morning">Morning</option>
                        <option value="night">Night</option>
                      </select>
                    </label>
                    <TextField
                      label="Biometric ID"
                      optional
                      value={userBiometricId}
                      onChange={(e) => setUserBiometricId(e.target.value)}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      optional
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <TextField
                      label="Email"
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                  </>
                )}
                <TextField
                  label="Mobile"
                  optional
                  value={userMobile}
                  onChange={(e) => setUserMobile(e.target.value)}
                />
                <TextField
                  label="Years worked"
                  type="number"
                  min={0}
                  step="any"
                  optional
                  value={userYearsWorked}
                  onChange={(e) => setUserYearsWorked(e.target.value)}
                />
                {show("visa") ? (
                <TextField
                  label="Visa expiry"
                  type="date"
                  optional
                  value={userVisaExpiry}
                  onChange={(e) => setUserVisaExpiry(e.target.value)}
                />
                ) : null}
                {dialogRole !== "Worker" ? (
                  <SharjahPermitFields
                    expiry={permit.expiry}
                    file={permit.file}
                    disabled={creating}
                    onExpiryChange={(expiry) => setPermit((current) => ({ ...current, expiry }))}
                    onFileChange={(file) => setPermit((current) => ({ ...current, file }))}
                    onUpload={(selected) => {
                      if (!user?.id) return Promise.reject(new Error("Sign in again"));
                      return uploadHrFile(user.id, selected);
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <PrimaryButton type="submit" disabled={creating}>
                    {creating ? "Creating…" : `Create ${dialogRole}`}
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

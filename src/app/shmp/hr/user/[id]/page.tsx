"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getProfile, getSalesLeave, getSalesProfiles, updateSalesProfile } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { SharjahPermitFields } from "@/components/HrProfileFields";
import { useToast } from "@/components/Toast";
import { isSupervisor } from "@/lib/auth";
import { portalFieldVisible } from "@/lib/custom-users";
import {
  emptySharjahPermit,
  loadSharjahPermit,
  saveSharjahPermit,
  type SharjahPermitState,
} from "@/lib/sharjah-permit";
import { uploadHrFile } from "@/lib/stl-features-api";
import { parseReturnTo } from "@/lib/user-management";
import {
  shmpAccessUser,
  shmpAccessUsers,
  shmpUpdateAccessUser,
  type ShmpAccessUser,
} from "@/lib/shmp-api";
import {
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { HrUserDocuments } from "@/components/HrStaffEditor";
import { SalarySlipCard } from "@/components/SalarySlipCard";
import {
  AttendanceHistory,
  trackedAccessRole,
  unwrapAccessUser,
  usersVisibleToSupervisor,
} from "../../shared";

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium break-all text-ink">{value || "—"}</dd>
    </div>
  );
}

export default function ShmpHrUserPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading user…" />}>
      <UserDetail />
    </Suspense>
  );
}

function UserDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const supervisor = isSupervisor(user);
  const showSalary = portalFieldVisible(user?.customAccess, "shmp", "hr", "salary");
  const returnTo = parseReturnTo(searchParams.get("returnTo"));
  const backHref = returnTo || (supervisor ? "/shmp/attendance" : "/shmp/hr");
  const backLabel = returnTo
    ? "Back to user management"
    : supervisor
      ? "Back to attendance"
      : "Back to HR";
  const id = String(params?.id || "");
  const [accessUser, setAccessUser] = useState<ShmpAccessUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [biometricUserId, setBiometricUserId] = useState("");
  const [password, setPassword] = useState("");
  const [permit, setPermit] = useState<SharjahPermitState>(emptySharjahPermit);
  const [savedPermit, setSavedPermit] = useState<SharjahPermitState>(emptySharjahPermit);
  const [permitReady, setPermitReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let found: ShmpAccessUser | null = null;
      try {
        found = unwrapAccessUser(await shmpAccessUser(id));
      } catch {
        found = null;
      }
      if (!found) {
        const list = await shmpAccessUsers().catch(() => [] as ShmpAccessUser[]);
        found = list.find((row) => row._id === id) || null;
      }
      if (!found && !supervisor) {
        try {
          const profile = await getProfile("sales", id);
          found = {
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            role: profile.role || "Sales",
            mobileNumber: profile.mobileNumber,
          };
        } catch {
          const sales = await getSalesProfiles().catch(() => []);
          const match = sales.find((row) => row._id === id);
          if (match) {
            found = {
              _id: match._id,
              name: match.name,
              email: match.email,
              role: match.role || "Sales",
              mobileNumber: match.mobileNumber,
            };
          }
        }
      }
      if (!found) throw new Error("User not found");
      if (supervisor && found.role !== "Supervisor") {
        throw new Error("You can only view Supervisor users");
      }
      const visible = supervisor
        ? usersVisibleToSupervisor([found])
        : [found];
      if (visible.length === 0) throw new Error("User not found");
      setAccessUser(found);
      setName(found.name || "");
      setMobile(found.mobileNumber || "");
      setBiometricUserId(found.biometricUserId || "");
      setPassword("");
      if (user?.id && !supervisor) {
        const loaded = await loadSharjahPermit(user.id, found._id);
        if (loaded) {
          setPermit(loaded);
          setSavedPermit(loaded);
          setPermitReady(true);
        } else {
          setPermitReady(false);
        }
      }
      if (trackedAccessRole(found.role)) {
        const leave = await getSalesLeave(found._id).catch(() => null);
        const bal = leave?.balance;
        setLeaveSummary(
          bal
            ? `Annual ${bal.remaining.annual}/${bal.entitlements.annual} remaining · Sick ${bal.remaining.sick}/${bal.entitlements.sick} remaining`
            : null,
        );
      } else {
        setLeaveSummary(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load user");
      setAccessUser(null);
    } finally {
      setLoading(false);
    }
  }, [id, supervisor, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(searchParams.get("edit") === "1");
  }, [searchParams]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (supervisor || !id || !name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        mobileNumber: mobile.trim(),
        biometricUserId: biometricUserId.trim(),
      };
      if (password.trim()) body.password = password.trim();
      try {
        await shmpUpdateAccessUser(id, body);
      } catch {
        await updateSalesProfile(id, body);
      }
      const permitChanged =
        permit.expiry !== savedPermit.expiry || permit.file?.key !== savedPermit.file?.key;
      if (permitReady && permitChanged && user?.id) {
        await saveSharjahPermit({
          adminUserId: user.id,
          personId: id,
          scope: "shmp",
          permit,
          fallbackName: name.trim(),
        });
      }
      toast("User updated", "success");
      setPassword("");
      setEditing(false);
      router.replace(`/shmp/hr/user/${id}`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading user…" />;
  if (error || !accessUser) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="text-sm text-slate-600 underline">
          {backLabel}
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "User not found"}
        </p>
      </div>
    );
  }

  const tracked = trackedAccessRole(accessUser.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={backHref} className="text-sm text-slate-600 underline">
            {backLabel}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">
            {accessUser.name || "User"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {accessUser.role || "—"}
            {accessUser.email ? ` · ${accessUser.email}` : ""}
          </p>
        </div>
        {!supervisor && !editing ? (
          <SecondaryButton type="button" onClick={() => setEditing(true)}>
            Edit
          </SecondaryButton>
        ) : null}
      </div>

      {editing && !supervisor ? (
        <form
          onSubmit={onSave}
          className="grid gap-3 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2"
        >
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <TextField
            label="Biometric ID"
            optional
            value={biometricUserId}
            onChange={(e) => setBiometricUserId(e.target.value)}
            placeholder="From device enrollment (e.g. 00000001)"
          />
          <TextField
            label="New password"
            type="password"
            optional
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current"
          />
          <SharjahPermitFields
            expiry={permit.expiry}
            file={permit.file}
            disabled={saving || !permitReady}
            onExpiryChange={(expiry) => setPermit((current) => ({ ...current, expiry }))}
            onFileChange={(file) => setPermit((current) => ({ ...current, file }))}
            onUpload={(selected) => {
              if (!user?.id) return Promise.reject(new Error("Sign in again"));
              return uploadHrFile(user.id, selected);
            }}
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditing(false);
                setName(accessUser.name || "");
                setMobile(accessUser.mobileNumber || "");
                setBiometricUserId(accessUser.biometricUserId || "");
                setPassword("");
                setPermit(savedPermit);
                router.replace(`/shmp/hr/user/${id}`);
              }}
            >
              Cancel
            </SecondaryButton>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={accessUser.name} />
            <DetailField label="Role" value={accessUser.role} />
            <DetailField label="Email" value={accessUser.email} />
            <DetailField label="Mobile" value={accessUser.mobileNumber} />
            <DetailField label="Biometric ID" value={accessUser.biometricUserId} />
            <DetailField
              label="Environments"
              value={(accessUser.environments || []).join(", ") || "Shared"}
            />
            {leaveSummary ? (
              <DetailField label="Leave balance" value={leaveSummary} />
            ) : null}
            <DetailField label="Sharjah permit expiry" value={permit.expiry || undefined} />
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Sharjah permit</dt>
              <dd className="mt-1 font-medium break-all text-ink">
                {permit.file?.url ? (
                  <a href={permit.file.url} target="_blank" rel="noreferrer" className="underline">
                    {permit.file.fileName}
                  </a>
                ) : (
                  permit.file?.fileName || "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {tracked ? (
        <AttendanceHistory kind="portal" personId={id} />
      ) : (
        <p className="text-sm text-slate-500">
          Admin logins are not tracked for attendance.
        </p>
      )}

      {!supervisor ? <HrUserDocuments personId={id} scope="shmp" /> : null}
      {!supervisor && showSalary ? <SalarySlipCard kind="user" personId={id} /> : null}
    </div>
  );
}

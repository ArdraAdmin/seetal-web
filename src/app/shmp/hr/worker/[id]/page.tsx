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
import { useToast } from "@/components/Toast";
import {
  shmpEmployee,
  shmpEmployees,
  shmpSetLeaveEntitlement,
  shmpUpdateEmployee,
  type ShmpWorkerShift,
} from "@/lib/shmp-api";
import {
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import {
  AttendanceHistory,
  DESIGNATIONS,
  capitalize,
  leaveLabel,
  loadWorkerLeave,
  unwrapEmployee,
  type Designation,
  type Emp,
} from "../../shared";

function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-ink">
        {value === 0 ? "0" : value || "—"}
      </dd>
    </div>
  );
}

export default function ShmpHrWorkerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading worker…" />}>
      <WorkerDetail />
    </Suspense>
  );
}

function WorkerDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = String(params?.id || "");
  const [emp, setEmp] = useState<Emp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState<Designation>("Operator");
  const [biometricId, setBiometricId] = useState("");
  const [shift, setShift] = useState<ShmpWorkerShift | "">("");
  const [annual, setAnnual] = useState("");
  const [sick, setSick] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let found = unwrapEmployee(await shmpEmployee(id).catch(() => null));
      if (!found) {
        const list = (await shmpEmployees()) as Emp[];
        found = list.find((row) => row._id === id) || null;
      }
      if (!found) throw new Error("Worker not found");
      const leave = await loadWorkerLeave(id);
      const merged: Emp = {
        ...found,
        leave: { ...found.leave, ...leave },
      };
      setEmp(merged);
      setName(merged.name || "");
      setDesignation(
        DESIGNATIONS.includes(merged.designation as Designation)
          ? (merged.designation as Designation)
          : "Staff",
      );
      setBiometricId(merged.biometricId || "");
      setShift(merged.defaultShift || "");
      setAnnual(
        String(
          merged.leave?.entitlement ?? merged.annualLeaveEntitlement ?? "",
        ),
      );
      setSick(
        String(
          merged.leave?.sickEntitlement ?? merged.sickLeaveEntitlement ?? "",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load worker");
      setEmp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(searchParams.get("edit") === "1");
  }, [searchParams]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id || !name.trim()) return;
    setSaving(true);
    try {
      const annualNum = annual.trim() === "" ? undefined : Number(annual);
      const sickNum = sick.trim() === "" ? undefined : Number(sick);
      if (
        (annualNum !== undefined && (!Number.isFinite(annualNum) || annualNum < 0)) ||
        (sickNum !== undefined && (!Number.isFinite(sickNum) || sickNum < 0))
      ) {
        toast("Leave days must be non-negative numbers", "info");
        setSaving(false);
        return;
      }
      await shmpUpdateEmployee(id, {
        name: name.trim(),
        designation,
        biometricId: biometricId.trim() || undefined,
        ...(shift ? { defaultShift: shift } : {}),
        ...(annualNum !== undefined ? { annualLeaveEntitlement: annualNum } : {}),
        ...(sickNum !== undefined ? { sickLeaveEntitlement: sickNum } : {}),
      });
      if (annualNum !== undefined || sickNum !== undefined) {
        await shmpSetLeaveEntitlement(id, {
          annualLeaveEntitlement: annualNum,
          sickLeaveEntitlement: sickNum,
          year: new Date().getFullYear(),
        }).catch(() => undefined);
      }
      toast("Worker updated", "success");
      setEditing(false);
      router.replace(`/shmp/hr/worker/${id}`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading worker…" />;
  if (error || !emp) {
    return (
      <div className="space-y-4">
        <Link href="/shmp/hr" className="text-sm text-slate-600 underline">
          Back to HR
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Worker not found"}
        </p>
      </div>
    );
  }

  const leave = leaveLabel(emp);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/shmp/hr" className="text-sm text-slate-600 underline">
            Back to HR
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-ink">{emp.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {emp.designation || "Worker"}
            {emp.employeeCode ? ` · ${emp.employeeCode}` : ""}
          </p>
        </div>
        {!editing ? (
          <SecondaryButton type="button" onClick={() => setEditing(true)}>
            Edit
          </SecondaryButton>
        ) : null}
      </div>

      {editing ? (
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
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-slate-700">Type</span>
            <select
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              value={designation}
              onChange={(e) => setDesignation(e.target.value as Designation)}
            >
              {DESIGNATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Biometric ID"
            value={biometricId}
            onChange={(e) => setBiometricId(e.target.value)}
          />
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium text-slate-700">Shift</span>
            <select
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              value={shift}
              onChange={(e) =>
                setShift(e.target.value as ShmpWorkerShift | "")
              }
            >
              <option value="">Not set</option>
              <option value="morning">Morning</option>
              <option value="night">Night</option>
            </select>
          </label>
          <TextField
            label="Annual leave days"
            type="number"
            min={0}
            optional
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
          />
          <TextField
            label="Sick leave days"
            type="number"
            min={0}
            optional
            value={sick}
            onChange={(e) => setSick(e.target.value)}
          />
          <div className="flex items-end gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => {
                setEditing(false);
                router.replace(`/shmp/hr/worker/${id}`);
              }}
            >
              Cancel
            </SecondaryButton>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={emp.name} />
            <DetailField label="Type" value={emp.designation} />
            <DetailField label="Biometric ID" value={emp.biometricId} />
            <DetailField label="Shift" value={capitalize(emp.defaultShift)} />
            <DetailField label="Email" value={emp.email} />
            <DetailField label="Mobile" value={emp.mobileNumber} />
            <DetailField label="Annual leave remaining" value={leave.annual} />
            <DetailField label="Sick leave remaining" value={leave.sick} />
            <DetailField label="Years worked" value={emp.visa?.yearsWorked} />
            <DetailField
              label="Visa expiry"
              value={emp.visa?.expiry ? emp.visa.expiry.slice(0, 10) : undefined}
            />
          </dl>
        </div>
      )}

      <AttendanceHistory kind="worker" personId={id} />
    </div>
  );
}

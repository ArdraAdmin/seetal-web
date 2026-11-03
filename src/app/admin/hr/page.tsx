"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { getWarehouseProfiles } from "@/lib/api";
import { addedHrStaffOnly, warehouseStaffLabel } from "@/lib/hr-scope";
import { warehouseField } from "@/lib/profiles";
import { VISA_ALERT_DAYS, isExpiringWithinDays } from "@/lib/expiry-window";
import { portalFieldVisible } from "@/lib/custom-users";
import { deleteHrStaff, getHrStaff, type HrStaff } from "@/lib/stl-features-api";

function visaSoon(expiry?: string) {
  return isExpiringWithinDays(expiry, VISA_ALERT_DAYS);
}

function rowRole(row: HrStaff, managerIds: Set<string>) {
  if (row.kind === "staff") {
    if (row.role === "Warehouse") {
      return warehouseStaffLabel(managerIds.has(row.linkedUserId || ""));
    }
    return row.role && row.role !== "Staff" ? row.role : "Staff";
  }
  return warehouseStaffLabel(managerIds.has(row.id));
}

export default function AdminHrPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const show = (fieldId: string) =>
    portalFieldVisible(user?.customAccess, "selling", "hr", fieldId);
  const [staff, setStaff] = useState<HrStaff[]>([]);
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [hr, warehouse] = await Promise.all([
        getHrStaff(user.id, { role: "Warehouse", scope: "stl" }),
        getWarehouseProfiles().catch(() => []),
      ]);
      setStaff(addedHrStaffOnly(hr.staff || []));
      setManagerIds(
        new Set(
          warehouse
            .filter((row) => warehouseField(row).isSuperManager)
            .map((row) => row._id),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(row: HrStaff) {
    if (!user?.id || row.kind !== "staff") return;
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

  const term = q.trim().toLowerCase();
  const rows = term
    ? staff.filter((s) =>
        `${s.name} ${s.email} ${rowRole(s, managerIds)}`.toLowerCase().includes(term),
      )
    : staff;

  return (
    <div>
      <PageHeader
        title="HR"
        subtitle="Joined date, years of service, and visa expiry for staff you add here."
        actions={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={() => router.push("/admin/hr/staff/new")}>
              Add staff
            </PrimaryButton>
            {show("salary") ? (
            <SecondaryButton type="button" onClick={() => router.push("/admin/hr/payroll")}>
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
        <TextField label="Search" placeholder="Name, email or role" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </td>
                  <td className="px-4 py-2">{rowRole(s, managerIds)}</td>
                  <td className="px-4 py-2">{fmtDateOnly(s.joiningDate)}</td>
                  <td className="px-4 py-2 text-right">{s.yearsOfService ?? "-"}</td>
                  {show("visa") ? (
                  <td
                    className={`px-4 py-2 ${visaSoon(s.hrProfile?.visaExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {fmtDateOnly(s.hrProfile?.visaExpiry)}
                  </td>
                  ) : null}
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={s.kind === "staff" ? `/admin/hr/staff/${s.id}` : `/admin/hr/${s.id}`}
                        className="font-medium text-brand-dark underline"
                      >
                        Edit
                      </Link>
                      {s.kind === "staff" ? (
                        <button
                          type="button"
                          className="font-medium text-red-700 underline disabled:opacity-50"
                          disabled={deletingId === s.id}
                          onClick={() => void onDelete(s)}
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
    </div>
  );
}

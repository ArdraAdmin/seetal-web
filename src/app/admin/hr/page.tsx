"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
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
import { isStlHrRole, warehouseStaffLabel } from "@/lib/hr-scope";
import { warehouseField } from "@/lib/profiles";
import { salesMoney } from "@/lib/sales";
import { SHARJAH_ALERT_DAYS, VISA_ALERT_DAYS, isExpiringWithinDays } from "@/lib/expiry-window";
import { getHrStaff, type HrStaff } from "@/lib/stl-features-api";

function visaSoon(expiry?: string) {
  return isExpiringWithinDays(expiry, VISA_ALERT_DAYS);
}

function sharjahSoon(expiry?: string) {
  return isExpiringWithinDays(expiry, SHARJAH_ALERT_DAYS);
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
  const { user } = useAuth();
  const [staff, setStaff] = useState<HrStaff[]>([]);
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [hr, warehouse] = await Promise.all([
        getHrStaff(user.id, { role: "Warehouse", scope: "stl" }),
        getWarehouseProfiles().catch(() => []),
      ]);
      setStaff((hr.staff || []).filter((row) => row.kind === "staff" || isStlHrRole(row.role)));
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
        subtitle="Warehouse user and warehouse manager visa, salary and increment records."
        actions={
          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" onClick={() => router.push("/admin/hr/staff/new")}>
              Add staff
            </PrimaryButton>
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
        <EmptyState title="No warehouse staff found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#f7f5f0] text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Years</th>
                <th className="px-4 py-2">Visa expiry</th>
                <th className="px-4 py-2">Sharjah permit</th>
                <th className="px-4 py-2 text-right">Basic salary</th>
                <th className="px-4 py-2 text-right">Total salary</th>
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
                  <td
                    className={`px-4 py-2 ${visaSoon(s.hrProfile?.visaExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {fmtDateOnly(s.hrProfile?.visaExpiry)}
                  </td>
                  <td
                    className={`px-4 py-2 ${sharjahSoon(s.hrProfile?.sharjahPermitExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {fmtDateOnly(s.hrProfile?.sharjahPermitExpiry)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.hrProfile?.basicSalary != null ? salesMoney(s.hrProfile.basicSalary) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.hrProfile?.totalSalary != null ? salesMoney(s.hrProfile.totalSalary) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={s.kind === "staff" ? `/admin/hr/staff/${s.id}` : `/admin/hr/${s.id}`}
                      className="font-medium text-brand-dark underline"
                    >
                      Edit
                    </Link>
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

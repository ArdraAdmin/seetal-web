"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteHrStaff, getHrStaff, type HrStaff } from "@/lib/stl-features-api";
import { useAuth } from "@/components/AuthProvider";
import { portalFieldVisible } from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import { HrStaffDetails } from "@/components/HrStaffDetails";
import { formatHrDate } from "@/lib/hr-profile";
import { sortHrStaff, type HrListSort } from "@/lib/hr-list";
import { isSupervisor } from "@/lib/auth";
import { VISA_ALERT_DAYS, isExpiringWithinDays } from "@/lib/expiry-window";
import { addedHrStaffOnly } from "@/lib/hr-scope";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { personHref } from "./shared";

type HrRow = {
  id: string;
  kind: "staff";
  name: string;
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
  const [sort, setSort] = useState<HrListSort>("name");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const hr = await getHrStaff(user.id, { scope: "shmp" });
      const rows: HrRow[] = addedHrStaffOnly(hr.staff || []).map((row) => ({
        id: row.id,
        kind: "staff" as const,
        name: row.hrProfile?.visaName || row.name,
        role: staffRole(row),
        joiningDate: row.joiningDate,
        yearsOfService: row.yearsOfService,
        visaExpiry: row.hrProfile?.visaExpiry,
      }));
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
  const rows = useMemo(() => {
    const matched = term
      ? staff.filter((s) => `${s.name} ${s.role}`.toLowerCase().includes(term))
      : staff;
    return sortHrStaff(matched, sort);
  }, [staff, term, sort]);

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
              <PrimaryButton type="button" onClick={() => router.push("/shmp/hr/staff/new")}>
                Add staff
              </PrimaryButton>
            ) : null}
            {!supervisor && show("salary") ? (
              <SecondaryButton type="button" onClick={() => router.push("/shmp/hr/payroll")}>
                Payroll
              </SecondaryButton>
            ) : null}
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <TextField
            label="Search"
            placeholder="Name or role"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-slate-700">Sort</span>
          <select
            className="min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            value={sort}
            onChange={(event) => setSort(event.target.value as HrListSort)}
          >
            <option value="name">Alphabetical</option>
            <option value="oldest">Oldest employee</option>
            <option value="visa">Visa expiry</option>
          </select>
        </label>
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
                <th className="px-4 py-2">No.</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-right">Years</th>
                {show("visa") ? <th className="px-4 py-2">Visa expiry</th> : null}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s, index) => (
                <tr key={`${s.kind}-${s.id}`}>
                  <td className="px-4 py-2 tabular-nums text-slate-500">{index + 1}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="text-left font-medium text-brand-dark underline"
                      onClick={() => setViewingId(s.id)}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="px-4 py-2">{s.role}</td>
                  <td className="px-4 py-2">{formatHrDate(s.joiningDate)}</td>
                  <td className="px-4 py-2 text-right">{s.yearsOfService ?? "-"}</td>
                  {show("visa") ? (
                  <td
                    className={`px-4 py-2 ${visaSoon(s.visaExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {formatHrDate(s.visaExpiry)}
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
      {viewingId ? (
        <HrStaffDetails staffId={viewingId} scope="shmp" onClose={() => setViewingId(null)} />
      ) : null}
    </div>
  );
}

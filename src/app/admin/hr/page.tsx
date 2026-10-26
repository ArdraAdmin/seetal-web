"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fmtDateOnly } from "@/components/StlFeatureUi";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { salesMoney } from "@/lib/sales";
import { getHrStaff, type HrStaff } from "@/lib/stl-features-api";

function visaSoon(expiry?: string) {
  if (!expiry) return false;
  const t = new Date(expiry).getTime();
  return Number.isFinite(t) && t - Date.now() < 60 * 24 * 3600 * 1000;
}

export default function AdminHrPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<HrStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      setStaff((await getHrStaff(user.id)).staff || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const term = q.trim().toLowerCase();
  const rows = term
    ? staff.filter((s) => `${s.name} ${s.email} ${s.role}`.toLowerCase().includes(term))
    : staff;

  return (
    <div>
      <PageHeader
        title="HR"
        subtitle="Staff visa, salary and increment records."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
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
        <EmptyState title="No staff found" />
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
                <th className="px-4 py-2 text-right">Basic salary</th>
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
                  <td className="px-4 py-2">{s.role}</td>
                  <td className="px-4 py-2">{fmtDateOnly(s.joiningDate)}</td>
                  <td className="px-4 py-2 text-right">{s.yearsOfService ?? "-"}</td>
                  <td
                    className={`px-4 py-2 ${visaSoon(s.hrProfile?.visaExpiry) ? "font-medium text-red-700" : ""}`}
                  >
                    {fmtDateOnly(s.hrProfile?.visaExpiry)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.hrProfile?.basicSalary != null ? salesMoney(s.hrProfile.basicSalary) : "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/hr/${s.id}`} className="font-medium text-brand-dark underline">
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

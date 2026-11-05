"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { HrUserDocuments } from "@/components/HrStaffEditor";
import { SalaryIncrementCard } from "@/components/SalaryIncrementCard";
import { SalarySlipCard } from "@/components/SalarySlipCard";
import { useAuth } from "@/components/AuthProvider";
import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { portalFieldVisible } from "@/lib/custom-users";
import { formatHrDate } from "@/lib/hr-profile";
import {
  addHrIncrement,
  deleteHrIncrement,
  getHrStaffMember,
  type HrStaff,
} from "@/lib/stl-features-api";

export default function AdminHrDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const showSalary = portalFieldVisible(user?.customAccess, "selling", "hr", "salary");
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salaryRevision, setSalaryRevision] = useState(0);

  const load = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    setError(null);
    try {
      setStaff(await getHrStaffMember(user.id, id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  const refreshSalary = useCallback(async () => {
    await load();
    setSalaryRevision((current) => current + 1);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

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
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <HrUserDocuments personId={id} showCompany scope="stl" reloadKey={salaryRevision} />
          {showSalary && staff && user?.id ? (
            <div>
              <p className="text-xs text-slate-500">
                Joined {formatHrDate(staff.joiningDate)}
                {staff.yearsOfService != null ? ` · ${staff.yearsOfService} years of service` : ""}
              </p>
              <SalaryIncrementCard
                staff={staff}
                scope="stl"
                layout="stack"
                onChanged={refreshSalary}
                add={(payload) => addHrIncrement(user.id, id, { ...payload, scope: "stl" })}
                remove={(entryId) => deleteHrIncrement(user.id, id, entryId)}
              />
            </div>
          ) : null}
        </div>
      )}
      {staff && showSalary ? <SalarySlipCard kind="user" personId={id} /> : null}
    </div>
  );
}

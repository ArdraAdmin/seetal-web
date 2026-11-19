"use client";

import { useAuth } from "@/components/AuthProvider";
import { Card, PageHeader } from "@/components/ui";

export default function SalesAccountPage() {
  const { user } = useAuth();

  const environments =
    user?.environments && user.environments.length > 0
      ? user.environments.map((env) => env.toUpperCase()).join(", ")
      : "—";

  return (
    <div>
      <PageHeader
        title="My account"
        subtitle="Your profile details for this sales login."
      />

      {!user ? (
        <Card>
          <p className="text-sm text-slate-500">No account details available.</p>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <dl className="divide-y divide-line">
            <ProfileRow label="Name" value={user.name || "—"} />
            <ProfileRow label="Email" value={user.email || "—"} />
            <ProfileRow label="Role" value={user.role || "—"} />
            <ProfileRow
              label="Mobile"
              value={user.mobileNumber?.trim() || "—"}
            />
            <ProfileRow label="Companies" value={environments} />
            <ProfileRow label="User ID" value={user.id || "—"} />
          </dl>
        </Card>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-all text-ink sm:text-right">
        {value}
      </dd>
    </div>
  );
}

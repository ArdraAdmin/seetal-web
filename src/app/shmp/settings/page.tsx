"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function ShmpSettingsPage() {
  const { user, clearSelectedEnvironment } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">SHMP Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Environment access and account.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 text-sm">
        <p>
          <span className="text-slate-500">User:</span> {user?.name} ({user?.email})
        </p>
        <p className="mt-2">
          <span className="text-slate-500">Role:</span> {user?.role}
        </p>
        <p className="mt-2">
          <span className="text-slate-500">Environments:</span>{" "}
          {(user?.environments || []).join(", ") || "stl (default)"}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => clearSelectedEnvironment()}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
        >
          Switch to STL / SHMP picker
        </button>
        <Link
          href="/shmp/reports"
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium"
        >
          Report recipients
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Grant SHMP access by setting <code>environments: [&quot;stl&quot;,&quot;shmp&quot;]</code>{" "}
        on the user document (migration script:{" "}
        <code>STLAPI/scripts/migrateEnvironments.js --super-both</code>).
      </p>
    </div>
  );
}

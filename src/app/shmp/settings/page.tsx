"use client";

import { useAuth } from "@/components/AuthProvider";
import { PasswordSettings } from "@/components/PasswordSettings";

export default function ShmpSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your account details and password.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 text-sm">
        <p>
          <span className="text-slate-500">Name:</span> {user?.name}
        </p>
        <p className="mt-2">
          <span className="text-slate-500">Email:</span> {user?.email}
        </p>
        <p className="mt-2">
          <span className="text-slate-500">Role:</span> {user?.role}
        </p>
      </div>
      <PasswordSettings title="Change password" />
    </div>
  );
}

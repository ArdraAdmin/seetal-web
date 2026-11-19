"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
} from "@/components/ui";
import { isAdmin, isSupervisor } from "@/lib/auth";
import {
  getBiometricDevices,
  type BiometricDeviceRow,
} from "@/lib/stl-features-api";

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function ShmpBiometricPage() {
  const { user } = useAuth();
  const allowed = isAdmin(user) || isSupervisor(user);
  const [devices, setDevices] = useState<BiometricDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const deviceRes = await getBiometricDevices();
      setDevices(deviceRes.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load biometric devices");
    } finally {
      setLoading(false);
    }
  }, [user?.id, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader title="Biometric devices" />
        <ErrorState message="Only admins and supervisors can manage biometric devices." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biometric devices"
        subtitle="Device online status. Set the scanner Web Server URL to your API host (same host as this app’s API)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shmp/attendance"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
            >
              Attendance
            </Link>
            <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading biometric devices…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <Card>
          <h2 className="text-sm font-semibold text-ink">Devices</h2>
          <p className="mt-1 text-sm text-slate-500">
            Online means a heartbeat was seen in the last two minutes.
          </p>
          {devices.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No devices seen yet"
                description="When the scanner reaches the API, it will appear here."
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Device ID</th>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Firmware</th>
                    <th className="px-2 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.devId} className="border-b border-line/70">
                      <td className="px-2 py-2">
                        <span
                          className={
                            device.online
                              ? "font-medium text-emerald-700"
                              : "font-medium text-slate-500"
                          }
                        >
                          {device.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-ink">{device.devId}</td>
                      <td className="px-2 py-2 text-ink">{device.name || "—"}</td>
                      <td className="px-2 py-2 text-slate-600">{device.firmware || "—"}</td>
                      <td className="px-2 py-2 text-slate-600">{formatWhen(device.lastSeenAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

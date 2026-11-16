"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { isAdmin, isSupervisor } from "@/lib/auth";
import {
  shmpAccessUsers,
  shmpEmployees,
  type ShmpAccessUser,
} from "@/lib/shmp-api";
import {
  assignBiometricId,
  getBiometricDevices,
  getBiometricUnmappedPunches,
  getHrStaff,
  type BiometricAssignKind,
  type BiometricDeviceRow,
  type BiometricUnmappedPunch,
  type HrStaff,
} from "@/lib/stl-features-api";

type PersonOption = {
  key: string;
  kind: BiometricAssignKind;
  id: string;
  label: string;
  searchText: string;
};

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function personKey(kind: BiometricAssignKind, id: string) {
  return `${kind}:${id}`;
}

function parsePersonKey(value: string): { kind: BiometricAssignKind; id: string } | null {
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!id || (kind !== "employee" && kind !== "staff" && kind !== "user")) return null;
  return { kind, id };
}

export default function ShmpBiometricPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const allowed = isAdmin(user) || isSupervisor(user);
  const [devices, setDevices] = useState<BiometricDeviceRow[]>([]);
  const [punches, setPunches] = useState<BiometricUnmappedPunch[]>([]);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedByPunch, setSelectedByPunch] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user?.id || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const [deviceRes, punchRes, staffRes, workers, accessUsers] = await Promise.all([
        getBiometricDevices(),
        getBiometricUnmappedPunches(),
        getHrStaff(user.id, { scope: "shmp" }).catch(() => ({ staff: [] as HrStaff[] })),
        shmpEmployees().catch(() => [] as unknown[]),
        shmpAccessUsers().catch(() => [] as ShmpAccessUser[]),
      ]);

      setDevices(deviceRes.devices || []);
      setPunches(punchRes.punches || []);

      const options: PersonOption[] = [];
      for (const row of workers as Array<Record<string, unknown>>) {
        const id = String(row._id || row.id || "");
        if (!id) continue;
        const name = String(row.name || "Worker");
        const bio = String(row.biometricUserId || row.biometricId || "");
        options.push({
          key: personKey("employee", id),
          kind: "employee",
          id,
          label: `${name} · Worker${bio ? ` · ID ${bio}` : ""}`,
          searchText: `${name} worker ${bio}`,
        });
      }
      for (const row of staffRes.staff || []) {
        if (row.kind && row.kind !== "staff") continue;
        const id = String(row.id || "");
        if (!id) continue;
        const bio = String(row.biometricUserId || "");
        options.push({
          key: personKey("staff", id),
          kind: "staff",
          id,
          label: `${row.name || "Staff"} · HR staff${bio ? ` · ID ${bio}` : ""}`,
          searchText: `${row.name || ""} staff ${bio}`,
        });
      }
      for (const row of accessUsers) {
        const id = String(row._id || "");
        if (!id) continue;
        if (String(row.role || "") === "Admin") continue;
        const bio = String(row.biometricUserId || "");
        options.push({
          key: personKey("user", id),
          kind: "user",
          id,
          label: `${row.name || "User"} · ${row.role || "Portal"}${bio ? ` · ID ${bio}` : ""}`,
          searchText: `${row.name || ""} ${row.role || ""} ${bio}`,
        });
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      setPeople(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load biometric data");
    } finally {
      setLoading(false);
    }
  }, [user?.id, allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  const personOptions = useMemo(
    () =>
      people.map((row) => ({
        id: row.key,
        label: row.label,
        searchText: row.searchText,
      })),
    [people],
  );

  async function onAssign(punch: BiometricUnmappedPunch) {
    const selected = selectedByPunch[punch.id];
    const parsed = selected ? parsePersonKey(selected) : null;
    if (!parsed) {
      toast("Choose a person for this punch", "info");
      return;
    }
    setAssigningId(punch.id);
    try {
      const result = await assignBiometricId({
        kind: parsed.kind,
        id: parsed.id,
        biometricUserId: punch.deviceUserId,
      });
      toast(
        `Linked device ID ${punch.deviceUserId} to ${result.name}. Unmapped punches for that ID will be applied.`,
        "success",
      );
      setSelectedByPunch((current) => {
        const next = { ...current };
        delete next[punch.id];
        return next;
      });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Assign failed", "error");
    } finally {
      setAssigningId(null);
    }
  }

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
        subtitle="Device online status and unmapped punches. Set the scanner Web Server URL to your API host (same host as this app’s API)."
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
        <LoadingState label="Loading biometric data…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
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

          <Card>
            <h2 className="text-sm font-semibold text-ink">Unmapped punches</h2>
            <p className="mt-1 text-sm text-slate-500">
              These scans arrived with a device user ID that is not linked to anyone yet. Assign
              the ID to a worker, HR staff member, or portal user.
            </p>
            {punches.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No unmapped punches"
                  description="New unknown scans will show up here."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {punches.map((punch) => (
                  <div
                    key={punch.id}
                    className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_minmax(14rem,18rem)_auto] sm:items-end"
                  >
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="font-medium text-ink">
                        Device user ID{" "}
                        <span className="font-mono">{punch.deviceUserId}</span>
                      </p>
                      <p className="text-slate-600">
                        {punch.verifyModeLabel || "Scan"} · device {punch.devId}
                      </p>
                      <p className="text-slate-500">
                        Punch {formatWhen(punch.punchTime)} · received{" "}
                        {formatWhen(punch.receivedAt)}
                      </p>
                    </div>
                    <SearchableSelect
                      label="Assign to"
                      value={selectedByPunch[punch.id] || ""}
                      onChange={(value) =>
                        setSelectedByPunch((current) => ({ ...current, [punch.id]: value }))
                      }
                      placeholder="Search people"
                      emptyOption={{ id: "", label: "Choose a person" }}
                      options={personOptions}
                    />
                    <PrimaryButton
                      type="button"
                      disabled={assigningId === punch.id}
                      onClick={() => void onAssign(punch)}
                    >
                      {assigningId === punch.id ? "Linking…" : "Link ID"}
                    </PrimaryButton>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

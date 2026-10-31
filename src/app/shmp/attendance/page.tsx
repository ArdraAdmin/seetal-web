"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  applySalesLeave,
  decideAdminLeave,
  getSalesProfiles,
} from "@/lib/api";
import {
  getPortalLeaveEntitlements,
  overrideSalesAttendance,
  savePortalLeaveEntitlements,
  updateHrStaff,
  type PortalLeaveEntitlement,
} from "@/lib/stl-features-api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { isSupervisor } from "@/lib/auth";
import {
  isShmpHrPortalRole,
  presentRowVisibleToCaller,
} from "@/lib/hr-scope";
import {
  shmpAccessUsers,
  shmpAttendance,
  shmpEmployees,
  shmpOverrideAttendance,
  shmpPresentToday,
  shmpSetLeaveEntitlement,
  shmpUpdateAccessUser,
  shmpUpdateEmployee,
  type ShmpAccessUser,
  type ShmpAttendanceRow,
  type ShmpPresentTodayRow,
} from "@/lib/shmp-api";
import { parseHrDayFilter } from "@/lib/shmp-dashboard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import {
  StatusBadge,
  attendanceEmployeeId,
  attendanceEmployeeName,
  badgeStatusFor,
  companyOf,
  leaveLabel,
  matchesQuery,
  mergeAccessAndSales,
  personHref,
  presentHref,
  trackedAccessRole,
  usersVisibleToSupervisor,
  type DayFilter,
  type Emp,
} from "../hr/shared";

type LeaveCandidate = {
  key: string;
  id: string;
  kind: "worker" | "portal";
  name: string;
  role: string;
  annualDisplay: string;
  sickDisplay: string;
  annualValue?: number;
  sickValue?: number;
};

function entitlementNum(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === "") continue;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function rangeFor(todayOnly: boolean) {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  if (!todayOnly) {
    from.setDate(from.getDate() - 30);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function ShmpAttendancePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading attendance…" />}>
      <AttendancePage />
    </Suspense>
  );
}

function AttendancePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const supervisor = isSupervisor(user);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dayFilter = parseHrDayFilter(searchParams.get("filter"));
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(true);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [users, setUsers] = useState<ShmpAccessUser[]>([]);
  const [attendance, setAttendance] = useState<ShmpAttendanceRow[]>([]);
  const [presentToday, setPresentToday] = useState<ShmpPresentTodayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overridePerson, setOverridePerson] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("present");
  const [overrideLeaveType, setOverrideLeaveType] = useState<"annual" | "sick">(
    "annual",
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const [leaveAnnual, setLeaveAnnual] = useState("");
  const [leaveSick, setLeaveSick] = useState("");
  const [savingLeave, setSavingLeave] = useState(false);
  const [selectedLeaveKeys, setSelectedLeaveKeys] = useState<string[]>([]);
  const [leaveListQuery, setLeaveListQuery] = useState("");
  const [portalLeave, setPortalLeave] = useState<
    Record<string, PortalLeaveEntitlement>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, accessUsers, salesProfiles] = await Promise.all([
        shmpEmployees() as Promise<Emp[]>,
        shmpAccessUsers().catch(() => [] as ShmpAccessUser[]),
        supervisor ? Promise.resolve([]) : getSalesProfiles().catch(() => []),
      ]);
      const workers = Array.isArray(list) ? list : [];
      const portal = (
        supervisor
          ? usersVisibleToSupervisor(accessUsers)
          : mergeAccessAndSales(accessUsers, salesProfiles)
      ).filter((row) => isShmpHrPortalRole(row.role));
      setEmployees(workers);
      setUsers(portal);
      setLoading(false);
      const range = rangeFor(todayOnly);
      const portalIds = portal.map((row) => row._id);
      const [att, present] = await Promise.all([
        shmpAttendance({
          mine: "0",
          from: range.from,
          to: range.to,
        }).catch(() => [] as ShmpAttendanceRow[]),
        shmpPresentToday().catch(() => [] as ShmpPresentTodayRow[]),
      ]);
      setAttendance(Array.isArray(att) ? att : []);
      setPresentToday(
        (Array.isArray(present) ? present : []).filter((row) =>
          presentRowVisibleToCaller(row, supervisor),
        ),
      );
      if (!portalIds.length) {
        setPortalLeave({});
      } else {
        void getPortalLeaveEntitlements(portalIds)
          .then(setPortalLeave)
          .catch(() => setPortalLeave({}));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
      setLoading(false);
    }
  }, [supervisor, todayOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const term = query.trim().toLowerCase();

  const attendanceByEmployeeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of attendance) {
      const id = attendanceEmployeeId(row);
      if (!id) continue;
      const status = String(row.status || "");
      const prev = map.get(id);
      const rank = (s: string | undefined) =>
        s === "present" || s === "half_day" ? 2 : s === "leave" ? 1 : 0;
      if (prev === undefined || rank(status) > rank(prev)) map.set(id, status);
    }
    return map;
  }, [attendance]);

  const presentWorkerIds = useMemo(
    () =>
      new Set(
        presentToday
          .filter((row) => row.kind === "worker")
          .map((row) => row._id),
      ),
    [presentToday],
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) =>
        matchesQuery(term, [
          emp.name,
          emp.designation,
          emp.email,
          emp.mobileNumber,
          emp.biometricId,
          emp.employeeCode,
        ]),
      ),
    [employees, term],
  );

  const leavePeople = useMemo(() => {
    const items: Array<{
      id: string;
      href: string;
      name: string;
      meta?: string;
      status: "leave";
    }> = [];
    const seen = new Set<string>();
    for (const row of presentToday) {
      if (badgeStatusFor(row.status) !== "leave") continue;
      seen.add(row._id);
      items.push({
        id: row._id,
        href: presentHref(row, users, employees),
        name: row.name,
        meta: row.role,
        status: "leave",
      });
    }
    for (const row of attendance) {
      if (String(row.status || "") !== "leave") continue;
      const id = attendanceEmployeeId(row);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        href: personHref("worker", id),
        name: attendanceEmployeeName(row),
        meta: row.leaveType ? `${row.leaveType} leave` : "Leave",
        status: "leave",
      });
    }
    return items.filter((item) => matchesQuery(term, [item.name, item.meta]));
  }, [attendance, presentToday, term, users, employees]);

  const presentPeople = useMemo(
    () =>
      presentToday.filter((row) =>
        matchesQuery(term, [row.name, row.role, row.designation]),
      ),
    [presentToday, term],
  );

  const absentPeople = useMemo(
    () =>
      filteredEmployees.filter((emp) => {
        const status = attendanceByEmployeeId.get(emp._id);
        if (status === "leave") return false;
        if (presentWorkerIds.has(emp._id)) return false;
        return status === "absent" || !status;
      }),
    [filteredEmployees, attendanceByEmployeeId, presentWorkerIds],
  );

  const daySummary = {
    total: employees.length + users.length,
    present: presentToday.length,
    absent: employees.filter((emp) => {
      const status = attendanceByEmployeeId.get(emp._id);
      if (status === "leave" || presentWorkerIds.has(emp._id)) return false;
      return status === "absent" || !status;
    }).length,
  };

  const leaveCount = useMemo(() => {
    const ids = new Set<string>();
    for (const row of presentToday) {
      if (badgeStatusFor(row.status) === "leave") ids.add(row._id);
    }
    for (const row of attendance) {
      if (String(row.status || "") === "leave") {
        const id = attendanceEmployeeId(row);
        if (id) ids.add(id);
      }
    }
    return ids.size;
  }, [attendance, presentToday]);

  const markPeople = useMemo(() => {
    const workers = employees.map((emp) => ({
      id: `worker:${emp._id}`,
      label: `${emp.name} (Worker)`,
    }));
    const portal = users.map((accessUser) => ({
      id: `portal:${accessUser._id}`,
      label: `${accessUser.name || accessUser.email || "User"} (${accessUser.role})`,
    }));
    return [...workers, ...portal];
  }, [employees, users]);

  const recentRows = useMemo(() => {
    return attendance.filter((row) => {
      const name = attendanceEmployeeName(row);
      const status = String(row.status || "");
      return matchesQuery(term, [name, status, row.leaveType]);
    });
  }, [attendance, term]);

  function setDayFilter(next: DayFilter | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("filter", next);
    else params.delete("filter");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleDayFilter(next: DayFilter) {
    setDayFilter(dayFilter === next ? null : next);
  }

  const leaveRoster = useMemo<LeaveCandidate[]>(() => {
    const workers: LeaveCandidate[] = employees.map((emp) => {
      const leave = leaveLabel(emp);
      return {
        key: `worker:${emp._id}`,
        id: emp._id,
        kind: "worker",
        name: emp.name,
        role: emp.designation ? `Worker · ${emp.designation}` : "Worker",
        annualDisplay: leave.annual,
        sickDisplay: leave.sick,
        annualValue: entitlementNum(emp.leave?.entitlement, emp.annualLeaveEntitlement),
        sickValue: entitlementNum(emp.leave?.sickEntitlement, emp.sickLeaveEntitlement),
      };
    });
    const portal: LeaveCandidate[] = users
      .filter((accessUser) => trackedAccessRole(accessUser.role))
      .map((accessUser) => {
        const ent = portalLeave[accessUser._id];
        return {
          key: `portal:${accessUser._id}`,
          id: accessUser._id,
          kind: "portal" as const,
          name: accessUser.name || accessUser.email || "User",
          role: accessUser.role || "User",
          annualDisplay: ent ? String(ent.annual) : "—",
          sickDisplay: ent ? String(ent.sick) : "—",
          annualValue: ent?.annual,
          sickValue: ent?.sick,
        };
      });
    return [...workers, ...portal];
  }, [employees, users, portalLeave]);

  const leaveCandidates = useMemo(() => {
    const listQuery = leaveListQuery.trim().toLowerCase();
    return leaveRoster.filter((row) => {
      if (!matchesQuery(term, [row.name, row.role])) return false;
      return matchesQuery(listQuery, [row.name, row.role]);
    });
  }, [leaveRoster, term, leaveListQuery]);

  const selectedVisibleCount = leaveCandidates.filter((row) =>
    selectedLeaveKeys.includes(row.key),
  ).length;
  const allVisibleSelected =
    leaveCandidates.length > 0 &&
    selectedVisibleCount === leaveCandidates.length;

  function setLeaveSelection(next: string[]) {
    setSelectedLeaveKeys(next);
    if (next.length !== 1) return;
    const only = leaveRoster.find((row) => row.key === next[0]);
    if (!only) return;
    setLeaveAnnual(only.annualValue != null ? String(only.annualValue) : "");
    setLeaveSick(only.sickValue != null ? String(only.sickValue) : "");
  }

  function closeMarkModal() {
    setMarkModalOpen(false);
    setOverrideReason("");
  }

  async function onOverride(e: FormEvent) {
    e.preventDefault();
    if (!overridePerson || !overrideReason.trim()) {
      setError("Person and reason are required");
      return;
    }
    const [kind, id] = overridePerson.split(":");
    setSavingOverride(true);
    setError(null);
    try {
      if (kind === "portal") {
        if (overrideStatus === "leave") {
          const leave = await applySalesLeave({
            userId: id,
            startDate: overrideDate,
            endDate: overrideDate,
            reason: overrideReason.trim(),
            leaveType: overrideLeaveType,
          });
          if (leave.status === "pending" && leave._id && user?.id) {
            await decideAdminLeave(leave._id, "approved", user.id).catch(
              () => undefined,
            );
          }
        } else if (user?.id) {
          await overrideSalesAttendance({
            userId: user.id,
            salesId: id,
            date: overrideDate,
            status: overrideStatus === "absent" ? "absent" : "present",
            reason: overrideReason.trim() || undefined,
          });
        } else {
          throw new Error("Sign in again to mark portal attendance");
        }
      } else {
        const emp = employees.find((row) => row._id === id);
        const companyId = companyOf(emp);
        if (!companyId) throw new Error("Selected worker has no company");
        await shmpOverrideAttendance({
          companyId,
          employeeId: id,
          date: new Date(overrideDate).toISOString(),
          newStatus: overrideStatus,
          ...(overrideStatus === "leave" ? { leaveType: overrideLeaveType } : {}),
          reason: overrideReason.trim(),
        });
      }
      toast("Attendance saved", "success");
      closeMarkModal();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setSavingOverride(false);
    }
  }

  async function onSaveLeave(e: FormEvent) {
    e.preventDefault();
    if (supervisor) return;
    const selected = leaveRoster.filter((row) =>
      selectedLeaveKeys.includes(row.key),
    );
    if (selected.length === 0) {
      toast("Select at least one person", "info");
      return;
    }
    const annualNum = Number(leaveAnnual);
    const sickNum = Number(leaveSick);
    if (
      !Number.isFinite(annualNum) ||
      !Number.isFinite(sickNum) ||
      annualNum < 0 ||
      sickNum < 0
    ) {
      toast("Enter valid non-negative leave days", "info");
      return;
    }
    setSavingLeave(true);
    setError(null);
    const year = new Date().getFullYear();
    let failed = 0;
    try {
      const workers = selected.filter((row) => row.kind === "worker");
      const portal = selected.filter((row) => row.kind === "portal");
      const workerResults = await Promise.allSettled(
        workers.map(async (row) => {
          await shmpUpdateEmployee(row.id, {
            annualLeaveEntitlement: annualNum,
            sickLeaveEntitlement: sickNum,
          });
          await shmpSetLeaveEntitlement(row.id, {
            annualLeaveEntitlement: annualNum,
            sickLeaveEntitlement: sickNum,
            year,
          }).catch(() => undefined);
        }),
      );
      failed += workerResults.filter((row) => row.status === "rejected").length;

      if (portal.length > 0) {
        let portalSaved = 0;
        try {
          const result = await savePortalLeaveEntitlements({
            userIds: portal.map((row) => row.id),
            annualLeaveDays: annualNum,
            sickLeaveDays: sickNum,
          });
          portalSaved = Number(result.updated) || 0;
        } catch {
          portalSaved = 0;
        }
        if (portalSaved === 0) {
          const portalResults = await Promise.allSettled(
            portal.map(async (row) => {
              await shmpUpdateAccessUser(row.id, {
                annualLeaveEntitlement: annualNum,
                sickLeaveEntitlement: sickNum,
              }).catch(() => undefined);
              if (user?.id) {
                await updateHrStaff(user.id, row.id, {
                  annualLeaveDays: annualNum,
                  sickLeaveDays: sickNum,
                }).catch(() => undefined);
              }
            }),
          );
          failed += portalResults.filter((row) => row.status === "rejected")
            .length;
        }
      }

      if (failed > 0) {
        toast(`Saved with ${failed} error(s)`, "info");
      } else {
        toast(
          `Leave saved for ${selected.length} ${selected.length === 1 ? "person" : "people"}`,
          "success",
        );
      }
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSavingLeave(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Attendance"
        subtitle={
          supervisor
            ? "Workers and supervisors check-in, leave and daily status."
            : "Sales, supervisor and factory worker check-in, leave and daily status."
        }
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void refresh()}>
            Refresh
          </SecondaryButton>
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTodayOnly(true)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            todayOnly ? "bg-brand text-black" : "bg-white border border-line"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setTodayOnly(false)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            !todayOnly ? "bg-brand text-black" : "bg-white border border-line"
          }`}
        >
          All recent
        </button>
      </div>

      <div className="max-w-sm">
        <TextField
          label="Search"
          placeholder="Name or role"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric
          label="Total staff"
          value={String(daySummary.total)}
          active={dayFilter === "total"}
          onClick={() => toggleDayFilter("total")}
        />
        <Metric
          label="Present today"
          value={String(daySummary.present)}
          active={dayFilter === "present"}
          onClick={() => toggleDayFilter("present")}
        />
        <Metric
          label="Absent today"
          value={String(daySummary.absent)}
          active={dayFilter === "absent"}
          onClick={() => toggleDayFilter("absent")}
        />
        <Metric
          label="On leave today"
          value={String(leaveCount)}
          active={dayFilter === "leave"}
          onClick={() => toggleDayFilter("leave")}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : null}

      {loading ? (
        <LoadingState label="Loading attendance…" />
      ) : dayFilter ? (
        <FilteredRoster
          filter={dayFilter}
          workers={filteredEmployees}
          users={users}
          present={presentPeople}
          absent={absentPeople}
          leave={leavePeople}
          employees={employees}
        />
      ) : recentRows.length === 0 && presentPeople.length === 0 ? (
        <EmptyState title="No attendance records" />
      ) : (
        <div className="space-y-4 pb-20">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-ink">
                  {todayOnly ? "Today's attendance" : "Recent attendance"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Workers via fingerprint;{" "}
                  {supervisor
                    ? "supervisors via portal check-in."
                    : "sales and supervisors via portal check-in."}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                {todayOnly ? `${presentToday.length} present` : `${recentRows.length} records`}
              </p>
            </div>
            {todayOnly ? (
              presentPeople.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  {term
                    ? "No present people match that search."
                    : "No one marked present yet today."}
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {presentPeople.map((row) => (
                    <li key={`${row.kind}-${row._id}`}>
                      <Link
                        href={presentHref(row, users, employees)}
                        className="block rounded-xl border border-line p-4 hover:bg-[#f7f5f0]/60"
                      >
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.role}
                          {row.designation ? ` · ${row.designation}` : ""}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          Check in: {fmtDateTime(row.checkInAt)}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Check out: {fmtDateTime(row.checkOutAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : recentRows.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {term ? "No records match that search." : "No recent attendance."}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentRows.map((row, index) => (
                  <li
                    key={row._id || `${attendanceEmployeeId(row)}-${index}`}
                    className="rounded-xl border border-line p-4"
                  >
                    <p className="font-semibold text-slate-900">
                      {attendanceEmployeeName(row)}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      Check in: {fmtDateTime(row.checkInAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Check out: {fmtDateTime(row.checkOutAt)}
                    </p>
                    {row.leaveType ? (
                      <p className="mt-2 text-sm text-slate-700">
                        Leave: {row.leaveType}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!supervisor && !dayFilter ? (
            <form
              onSubmit={onSaveLeave}
              className="rounded-2xl border border-line bg-white p-5"
            >
              <h2 className="font-semibold text-ink">Leave entitlements</h2>
              <p className="mt-1 text-xs text-slate-500">
                Select sales users, supervisors and workers, then set annual and sick
                leave days for everyone selected.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-line"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const visibleKeys = leaveCandidates.map((row) => row.key);
                      if (e.target.checked) {
                        setLeaveSelection([
                          ...new Set([...selectedLeaveKeys, ...visibleKeys]),
                        ]);
                      } else {
                        const hide = new Set(visibleKeys);
                        setLeaveSelection(
                          selectedLeaveKeys.filter((key) => !hide.has(key)),
                        );
                      }
                    }}
                  />
                  Select all
                  <span className="font-normal text-slate-500">
                    ({selectedLeaveKeys.length} selected)
                  </span>
                </label>
                <input
                  type="search"
                  value={leaveListQuery}
                  onChange={(e) => setLeaveListQuery(e.target.value)}
                  placeholder="Filter this list"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:max-w-xs"
                />
              </div>
              <ul className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-line divide-y divide-line/60">
                {leaveCandidates.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-slate-500">
                    No people to show.
                  </li>
                ) : (
                  leaveCandidates.map((row) => {
                    const checked = selectedLeaveKeys.includes(row.key);
                    return (
                      <li key={row.key}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-[#f7f5f0]/60">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-line"
                            checked={checked}
                            onChange={() => {
                              setLeaveSelection(
                                checked
                                  ? selectedLeaveKeys.filter((key) => key !== row.key)
                                  : [...selectedLeaveKeys, row.key],
                              );
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-ink">
                              {row.name}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {row.role} · Annual {row.annualDisplay} · Sick{" "}
                              {row.sickDisplay}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <TextField
                  label="Annual leave days"
                  type="number"
                  min={0}
                  required
                  value={leaveAnnual}
                  onChange={(e) => setLeaveAnnual(e.target.value)}
                />
                <TextField
                  label="Sick leave days"
                  type="number"
                  min={0}
                  required
                  value={leaveSick}
                  onChange={(e) => setLeaveSick(e.target.value)}
                />
                <div className="flex items-end">
                  <PrimaryButton
                    type="submit"
                    disabled={savingLeave || selectedLeaveKeys.length === 0}
                  >
                    {savingLeave
                      ? "Saving…"
                      : `Save for ${selectedLeaveKeys.length || 0}`}
                  </PrimaryButton>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      )}

      {!loading ? (
        <button
          type="button"
          aria-label="Mark attendance"
          onClick={() => setMarkModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-ink shadow-lg ring-1 ring-black/5 transition hover:bg-brand-dark hover:text-white lg:bottom-8 lg:right-8"
        >
          <Plus className="h-7 w-7" strokeWidth={2.25} />
        </button>
      ) : null}

      {markModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-attendance-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMarkModal();
          }}
        >
          <form
            onSubmit={onOverride}
            className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2
                  id="mark-attendance-title"
                  className="text-lg font-semibold text-ink"
                >
                  Mark attendance / leave
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {supervisor
                    ? "Record present, absent, or annual/sick leave for a worker or supervisor."
                    : "Record present, absent, or annual/sick leave for a worker, sales user or supervisor."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeMarkModal}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={overridePerson}
              onChange={(e) => setOverridePerson(e.target.value)}
              required
            >
              <option value="">Select person</option>
              {markPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              required
            />
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              {overridePerson.startsWith("worker:") ? (
                <option value="holiday">Holiday</option>
              ) : null}
            </select>
            {overrideStatus === "leave" ? (
              <select
                className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                value={overrideLeaveType}
                onChange={(e) =>
                  setOverrideLeaveType(e.target.value as "annual" | "sick")
                }
              >
                <option value="annual">Annual leave</option>
                <option value="sick">Sick leave</option>
              </select>
            ) : null}
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Reason (required)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-1">
              <SecondaryButton type="button" onClick={closeMarkModal}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={savingOverride}>
                {savingOverride ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-brand bg-brand/20 ring-2 ring-brand"
          : "border-line bg-white hover:border-brand"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
    </button>
  );
}

function FilteredRoster({
  filter,
  workers,
  present,
  absent,
  leave,
  users,
  employees,
}: {
  filter: DayFilter;
  workers: Emp[];
  present: ShmpPresentTodayRow[];
  absent: Emp[];
  leave: Array<{
    id: string;
    href: string;
    name: string;
    meta?: string;
    status: "leave";
  }>;
  users: ShmpAccessUser[];
  employees: Emp[];
}) {
  const title =
    filter === "total"
      ? "All staff"
      : filter === "present"
        ? "Present today"
        : filter === "absent"
          ? "Absent today"
          : "On leave today";

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      {filter === "total" ? (
        workers.length + users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No staff to show.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {users.map((accessUser) => (
              <li key={`user-${accessUser._id}`}>
                <Link
                  href={personHref("user", accessUser._id)}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {accessUser.name || accessUser.email || "User"}
                    </p>
                    <p className="text-xs text-slate-500">{accessUser.role || "User"}</p>
                  </div>
                </Link>
              </li>
            ))}
            {workers.map((emp) => (
              <li key={emp._id}>
                <Link
                  href={personHref("worker", emp._id)}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{emp.name}</p>
                    <p className="text-xs text-slate-500">
                      {emp.designation || "Worker"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {filter === "present" ? (
        present.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No one is present yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {present.map((row) => (
              <li key={`${row.kind}-${row._id}`}>
                <Link
                  href={presentHref(row, users, employees)}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.role}
                      {row.designation ? ` · ${row.designation}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={badgeStatusFor(row.status)} />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {filter === "absent" ? (
        absent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No absences today.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {absent.map((emp) => (
              <li key={emp._id}>
                <Link
                  href={personHref("worker", emp._id)}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{emp.name}</p>
                    <p className="text-xs text-slate-500">
                      {emp.designation || "Worker"}
                    </p>
                  </div>
                  <StatusBadge status="absent" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {filter === "leave" ? (
        leave.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No one is on leave today.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
            {leave.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.meta}</p>
                  </div>
                  <StatusBadge status="leave" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

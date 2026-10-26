"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  applySalesLeave,
  decideAdminLeave,
  getCompanies,
  getSalesProfiles,
} from "@/lib/api";
import {
  getPortalLeaveEntitlements,
  overrideSalesAttendance,
  savePortalLeaveEntitlements,
  updateHrStaff,
  type PortalLeaveEntitlement,
} from "@/lib/stl-features-api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { isSupervisor } from "@/lib/auth";
import {
  shmpAccessUsers,
  shmpAttendance,
  shmpCreateAccessUser,
  shmpCreateAccessWorker,
  shmpDeactivateEmployee,
  shmpEmployees,
  shmpOverrideAttendance,
  shmpPresentToday,
  shmpSetLeaveEntitlement,
  shmpUpdateAccessUser,
  shmpUpdateEmployee,
  type ShmpAccessRole,
  type ShmpAccessUser,
  type ShmpAttendanceRow,
  type ShmpPresentTodayRow,
  type ShmpWorkerShift,
} from "@/lib/shmp-api";
import {
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import {
  StatusBadge,
  attendanceEmployeeId,
  attendanceEmployeeName,
  badgeStatusFor,
  capitalize,
  companyOf,
  formatCheckIn,
  leaveLabel,
  matchesQuery,
  personHref,
  presentHref,
  trackedAccessRole,
  usersVisibleToSupervisor,
  type DayFilter,
  type Emp,
} from "./shared";

const ADMIN_USER_ROLES: ShmpAccessRole[] = ["Admin", "Supervisor", "Sales"];
const SUPERVISOR_USER_ROLES: ShmpAccessRole[] = ["Supervisor"];

type DialogMode = "Worker" | ShmpAccessRole;

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

function mergeAccessAndSales(
  access: ShmpAccessUser[],
  sales: Array<{
    _id: string;
    name: string;
    email?: string;
    role?: string;
    mobileNumber?: string;
  }>,
): ShmpAccessUser[] {
  const map = new Map<string, ShmpAccessUser>();
  for (const user of access) map.set(user._id, user);
  for (const row of sales) {
    const existing = map.get(row._id);
    if (existing) {
      map.set(row._id, {
        ...existing,
        name: existing.name || row.name,
        email: existing.email || row.email,
        mobileNumber: existing.mobileNumber || row.mobileNumber,
        role: existing.role || row.role || "Sales",
      });
    } else {
      map.set(row._id, {
        _id: row._id,
        name: row.name,
        email: row.email,
        role: row.role || "Sales",
        mobileNumber: row.mobileNumber,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    (a.name || a.email || "").localeCompare(b.name || b.email || ""),
  );
}

export default function ShmpHrPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const supervisor = isSupervisor(user);
  const userRoles = supervisor ? SUPERVISOR_USER_ROLES : ADMIN_USER_ROLES;
  const [tab, setTab] = useState<"employees" | "attendance">("employees");
  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [users, setUsers] = useState<ShmpAccessUser[]>([]);
  const [attendance, setAttendance] = useState<ShmpAttendanceRow[]>([]);
  const [presentToday, setPresentToday] = useState<ShmpPresentTodayRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRole, setDialogRole] = useState<DialogMode | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userMobile, setUserMobile] = useState("");
  const [userYearsWorked, setUserYearsWorked] = useState("");
  const [userVisaExpiry, setUserVisaExpiry] = useState("");
  const [userShift, setUserShift] = useState<ShmpWorkerShift>("morning");
  const [userBiometricId, setUserBiometricId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setError(null);
    try {
      const [list, accessUsers, salesProfiles] = await Promise.all([
        shmpEmployees() as Promise<Emp[]>,
        shmpAccessUsers().catch(() => [] as ShmpAccessUser[]),
        supervisor
          ? Promise.resolve([])
          : getSalesProfiles().catch(() => []),
      ]);
      setEmployees(Array.isArray(list) ? list : []);
      setUsers(
        mergeAccessAndSales(
          Array.isArray(accessUsers) ? accessUsers : [],
          salesProfiles,
        ),
      );
      const today = new Date();
      const from = new Date(today);
      from.setHours(0, 0, 0, 0);
      const to = new Date(today);
      to.setHours(23, 59, 59, 999);
      const [att, present] = await Promise.all([
        shmpAttendance({
          mine: "0",
          from: from.toISOString(),
          to: to.toISOString(),
        }),
        shmpPresentToday().catch(() => [] as ShmpPresentTodayRow[]),
      ]);
      setAttendance(Array.isArray(att) ? att : []);
      setPresentToday(Array.isArray(present) ? present : []);
      const portalIds = mergeAccessAndSales(
        Array.isArray(accessUsers) ? accessUsers : [],
        salesProfiles,
      )
        .filter((row) => trackedAccessRole(row.role))
        .map((row) => row._id);
      setPortalLeave(
        portalIds.length
          ? await getPortalLeaveEntitlements(portalIds).catch(
              () => ({} as Record<string, PortalLeaveEntitlement>),
            )
          : {},
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [supervisor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dialogRoles = useMemo<DialogMode[]>(
    () => (supervisor ? userRoles : ["Worker", ...userRoles]),
    [supervisor, userRoles],
  );

  const visibleUsers = useMemo(
    () => (supervisor ? usersVisibleToSupervisor(users) : users),
    [supervisor, users],
  );

  const term = query.trim().toLowerCase();

  const filteredUsers = useMemo(
    () =>
      visibleUsers.filter((accessUser) =>
        matchesQuery(term, [
          accessUser.name,
          accessUser.email,
          accessUser.role,
          accessUser.mobileNumber,
        ]),
      ),
    [visibleUsers, term],
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
        href: presentHref(row, visibleUsers, employees),
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
    return items.filter((item) =>
      matchesQuery(term, [item.name, item.meta]),
    );
  }, [attendance, presentToday, term, visibleUsers, employees]);

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
    total: employees.length,
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
    const portal = visibleUsers
      .filter((accessUser) => trackedAccessRole(accessUser.role))
      .map((accessUser) => ({
        id: `portal:${accessUser._id}`,
        label: `${accessUser.name || accessUser.email || "User"} (${accessUser.role})`,
      }));
    return [...workers, ...portal];
  }, [employees, visibleUsers]);

  function resetDialog() {
    setDialogOpen(false);
    setDialogRole(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserMobile("");
    setUserYearsWorked("");
    setUserVisaExpiry("");
    setUserShift("morning");
    setUserBiometricId("");
  }

  function openDialog() {
    resetDialog();
    setDialogOpen(true);
  }

  function toggleDayFilter(next: DayFilter) {
    setDayFilter((current) => (current === next ? null : next));
    if (next === "total") setTab("employees");
    else setTab("attendance");
  }

  const leaveRoster = useMemo<LeaveCandidate[]>(() => {
    const workers: LeaveCandidate[] = employees.map((emp) => {
      const leave = leaveLabel(emp);
      const annualValue = entitlementNum(
        emp.leave?.entitlement,
        emp.annualLeaveEntitlement,
      );
      const sickValue = entitlementNum(
        emp.leave?.sickEntitlement,
        emp.sickLeaveEntitlement,
      );
      return {
        key: `worker:${emp._id}`,
        id: emp._id,
        kind: "worker",
        name: emp.name,
        role: emp.designation ? `Worker · ${emp.designation}` : "Worker",
        annualDisplay: leave.annual,
        sickDisplay: leave.sick,
        annualValue,
        sickValue,
      };
    });
    const portal: LeaveCandidate[] = visibleUsers
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
  }, [employees, visibleUsers, portalLeave]);

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

  async function onCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!dialogRole) return;
    if (supervisor || !dialogRoles.includes(dialogRole)) {
      toast("Only admins can create users", "info");
      return;
    }
    const yearsWorked =
      userYearsWorked.trim() === "" ? undefined : Number(userYearsWorked);
    if (
      yearsWorked !== undefined &&
      (!Number.isFinite(yearsWorked) || yearsWorked < 0)
    ) {
      toast("Years worked must be a non-negative number", "info");
      return;
    }
    if (dialogRole === "Worker") {
      if (!userName.trim()) {
        toast("Name is required", "info");
        return;
      }
      setCreating(true);
      setError(null);
      try {
        let company = "";
        try {
          const companies = await getCompanies();
          company = resolveSalesCompanyByKey("shmp", companies)?.id || "";
        } catch {
          // fall back to an existing worker's company below
        }
        if (!company) company = companyOf(employees[0]);
        if (!company) {
          throw new Error("Could not determine SHMP company for this worker");
        }
        const visa: { yearsWorked?: number; expiry?: string } = {};
        if (yearsWorked !== undefined) visa.yearsWorked = yearsWorked;
        if (userVisaExpiry) visa.expiry = userVisaExpiry;
        await shmpCreateAccessWorker({
          name: userName.trim(),
          company,
          designation: "Operator",
          defaultShift: userShift,
          biometricId: userBiometricId.trim() || undefined,
          email: userEmail.trim() || undefined,
          mobileNumber: userMobile.trim() || undefined,
          visa: Object.keys(visa).length ? visa : undefined,
        });
        toast("Worker created", "success");
        resetDialog();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        setError(message);
        toast(message, "error");
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!userName.trim() || !userEmail.trim() || !userPassword.trim()) {
      toast("Name, email, and password are required", "info");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await shmpCreateAccessUser({
        role: dialogRole,
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword.trim(),
        mobileNumber: userMobile.trim() || undefined,
        ...(dialogRole === "Sales" ? { environments: ["stl", "shmp"] } : {}),
      });
      toast(`${dialogRole} user created`, "success");
      resetDialog();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toast(message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(emp: Emp) {
    if (!confirm(`Remove ${emp.name} from staff?`)) return;
    setDeletingId(emp._id);
    setError(null);
    try {
      await shmpDeactivateEmployee(emp._id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
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

  const showRoster = dayFilter !== null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">HR & Attendance</h1>
          <p className="mt-1 text-sm text-slate-600">
            {supervisor
              ? "View Supervisor logins and factory workers. Workers punch in by fingerprint; you check in from the portal."
              : "Manage Admin, Supervisor, and Sales logins. Sales users are shared with STL. Workers punch in by fingerprint; Sales and Supervisors check in from the portal."}
          </p>
        </div>
        {!supervisor ? (
          <PrimaryButton type="button" onClick={openDialog}>
            Add user
          </PrimaryButton>
        ) : null}
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users and workers"
          className="w-full rounded-xl border border-line bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric
          label="Total workers"
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

      <div className="flex flex-wrap gap-2">
        <TabBtn
          active={!showRoster && tab === "employees"}
          onClick={() => {
            setDayFilter(null);
            setTab("employees");
          }}
        >
          Users
        </TabBtn>
        <TabBtn
          active={!showRoster && tab === "attendance"}
          onClick={() => {
            setDayFilter(null);
            setTab("attendance");
          }}
        >
          Attendance
        </TabBtn>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {showRoster ? (
        <FilteredRoster
          filter={dayFilter}
          workers={filteredEmployees}
          present={presentPeople}
          absent={absentPeople}
          leave={leavePeople}
          users={visibleUsers}
          employees={employees}
        />
      ) : null}

      {!showRoster && tab === "employees" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">
              Users ({filteredUsers.length})
            </h2>
            {filteredUsers.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {term
                  ? "No users match that search."
                  : supervisor
                    ? "No Supervisor users yet."
                    : "No Admin, Supervisor, or Sales users yet. Click Add user to create one."}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {filteredUsers.map((accessUser) => (
                  <li key={accessUser._id} className="py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={personHref("user", accessUser._id)}
                        className="min-w-0 hover:underline"
                      >
                        <p className="font-medium text-ink">
                          {accessUser.name || "Unnamed"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {accessUser.role || "—"}
                          {accessUser.email ? ` · ${accessUser.email}` : ""}
                          {accessUser.mobileNumber
                            ? ` · ${accessUser.mobileNumber}`
                            : ""}
                        </p>
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={personHref("user", accessUser._id)}
                          className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
                        >
                          View
                        </Link>
                        {!supervisor ? (
                          <Link
                            href={personHref("user", accessUser._id, true)}
                            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
                          >
                            Edit
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold text-ink">
              Factory workers ({filteredEmployees.length})
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Used for attendance and leave. No login accounts.
            </p>
            {filteredEmployees.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                {term ? "No workers match that search." : "No workers loaded."}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {filteredEmployees.map((emp) => {
                  const todayStatus = badgeStatusFor(
                    attendanceByEmployeeId.get(emp._id),
                  );
                  const leave = leaveLabel(emp);
                  return (
                    <li key={emp._id} className="py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                          href={personHref("worker", emp._id)}
                          className="min-w-0 hover:underline"
                        >
                          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            {emp.name}
                            <StatusBadge status={todayStatus} />
                          </p>
                          <p className="text-sm text-slate-500">
                            {emp.designation || "—"}
                            {emp.biometricId ? ` · Bio ${emp.biometricId}` : ""}
                            {" · "}
                            Shift: {capitalize(emp.defaultShift)}
                          </p>
                          <p className="text-sm text-slate-500">
                            Annual leave: {leave.annual}
                            {" · "}
                            Sick leave: {leave.sick}
                          </p>
                        </Link>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={personHref("worker", emp._id)}
                            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
                          >
                            View
                          </Link>
                          <Link
                            href={personHref("worker", emp._id, true)}
                            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
                          >
                            Edit
                          </Link>
                          <SecondaryButton
                            type="button"
                            className="border-red-200 text-red-700"
                            disabled={deletingId === emp._id}
                            onClick={() => void onDelete(emp)}
                          >
                            {deletingId === emp._id ? "Removing…" : "Delete"}
                          </SecondaryButton>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {!showRoster && tab === "attendance" ? (
        <div className="space-y-4 pb-20">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-ink">Today&apos;s attendance</h2>
                <p className="mt-1 text-xs text-slate-500">
                  People present today — workers via fingerprint, Sales and
                  Supervisors via check-in. Admins are not tracked.
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                {presentToday.length} present
              </p>
            </div>
            {presentPeople.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {term
                  ? "No present people match that search."
                  : "No one marked present yet today."}
              </p>
            ) : (
              <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto text-sm">
                {presentPeople.map((row) => {
                  const time = formatCheckIn(row.checkInAt);
                  return (
                    <li key={`${row.kind}-${row._id}`}>
                      <Link
                        href={presentHref(row, visibleUsers, employees)}
                        className="flex items-center justify-between gap-3 border-b border-line/50 py-2.5 hover:bg-[#f7f5f0]/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {row.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.role}
                            {row.designation ? ` · ${row.designation}` : ""}
                            {time ? ` · In ${time}` : ""}
                          </p>
                        </div>
                        <StatusBadge
                          status={
                            row.status === "leave"
                              ? "leave"
                              : badgeStatusFor(row.status)
                          }
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!supervisor ? (
            <form
              onSubmit={onSaveLeave}
              className="rounded-2xl border border-line bg-white p-5"
            >
              <h2 className="font-semibold text-ink">Leave entitlements</h2>
              <p className="mt-1 text-xs text-slate-500">
                Select workers, Sales, and Supervisors, then set annual and sick
                leave days for everyone selected. Recording a leave day uses the
                plus button.
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
                                  ? selectedLeaveKeys.filter(
                                      (key) => key !== row.key,
                                    )
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

          <button
            type="button"
            aria-label="Mark attendance"
            onClick={() => setMarkModalOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-ink shadow-lg ring-1 ring-black/5 transition hover:bg-brand-dark hover:text-white lg:bottom-8 lg:right-8"
          >
            <Plus className="h-7 w-7" strokeWidth={2.25} />
          </button>
        </div>
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
                  Record present, absent, or annual/sick leave for a worker or
                  Sales/Supervisor user.
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

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetDialog();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-lg">
            {!dialogRole ? (
              <>
                <h2
                  id="add-user-title"
                  className="text-lg font-semibold text-ink"
                >
                  Create user
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the type of user to create.
                </p>
                <div className="mt-4 grid gap-2">
                  {dialogRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setDialogRole(role)}
                      className="rounded-xl border border-line px-4 py-3 text-left text-sm font-medium hover:border-brand hover:bg-brand/15"
                    >
                      {role}
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {role === "Worker"
                          ? "Factory employee — attendance via fingerprint (no portal login)"
                          : role === "Admin"
                            ? "Full SHMP and STL access (attendance not tracked)"
                            : role === "Supervisor"
                              ? "SHMP manufacturing oversight — daily check-in required"
                              : "Shared with STL — place orders, daily check-in required"}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Cancel
                  </SecondaryButton>
                </div>
              </>
            ) : (
              <form onSubmit={onCreateUser} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2
                      id="add-user-title"
                      className="text-lg font-semibold text-ink"
                    >
                      New {dialogRole}
                    </h2>
                    <button
                      type="button"
                      className="mt-1 text-xs text-slate-600 underline"
                      onClick={() => setDialogRole(null)}
                    >
                      Change type
                    </button>
                  </div>
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Close
                  </SecondaryButton>
                </div>
                <TextField
                  label="Name"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                {dialogRole === "Worker" ? (
                  <>
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-medium text-slate-700">
                        Shift
                      </span>
                      <select
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        value={userShift}
                        onChange={(e) =>
                          setUserShift(e.target.value as ShmpWorkerShift)
                        }
                      >
                        <option value="morning">Morning</option>
                        <option value="night">Night</option>
                      </select>
                    </label>
                    <TextField
                      label="Biometric ID"
                      optional
                      value={userBiometricId}
                      onChange={(e) => setUserBiometricId(e.target.value)}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      optional
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <TextField
                      label="Email"
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                    <TextField
                      label="Password"
                      type="password"
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                    />
                  </>
                )}
                <TextField
                  label="Mobile"
                  optional
                  value={userMobile}
                  onChange={(e) => setUserMobile(e.target.value)}
                />
                <TextField
                  label="Years worked"
                  type="number"
                  min={0}
                  step="any"
                  optional
                  value={userYearsWorked}
                  onChange={(e) => setUserYearsWorked(e.target.value)}
                />
                <TextField
                  label="Visa expiry"
                  type="date"
                  optional
                  value={userVisaExpiry}
                  onChange={(e) => setUserVisaExpiry(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <PrimaryButton type="submit" disabled={creating}>
                    {creating ? "Creating…" : `Create ${dialogRole}`}
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={resetDialog}>
                    Cancel
                  </SecondaryButton>
                </div>
              </form>
            )}
          </div>
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

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand text-black" : "border border-line bg-white"
      }`}
    >
      {children}
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
      ? "All workers"
      : filter === "present"
        ? "Present today"
        : filter === "absent"
          ? "Absent today"
          : "On leave today";

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      {filter === "total" ? (
        workers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No workers to show.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/60">
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

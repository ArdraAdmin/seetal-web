"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  getAdminAttendance,
  type AttendanceRecord,
} from "@/lib/api";
import {
  getAttendanceOverrides,
  getHrStaff,
  getHrStaffAttendance,
  getPortalLeaveEntitlements,
  markHrStaffAttendance,
  overrideSalesAttendance,
  recordHrFine,
  savePortalLeaveEntitlements,
  updateHrStaff,
  type HrStaffAttendanceMark,
  type PortalLeaveEntitlement,
} from "@/lib/stl-features-api";
import { useAuth } from "@/components/AuthProvider";
import { shmpActionOn } from "@/lib/shmp-permissions";
import { useToast } from "@/components/Toast";
import { isSupervisor } from "@/lib/auth";
import { MarkAttendanceDialog } from "@/components/MarkAttendanceDialog";
import {
  attendanceDatesInRange,
  attendanceDayKey,
  attendanceMarkSpan,
  attendanceSaveStatus,
  awayLabel,
  holidayStatusAvailable,
  mapWithLimit,
  personAwayKind,
} from "@/lib/attendance-bulk";
import {
  addedHrStaffOnly,
  attendanceRecordUserId,
  hrPeopleMissingFromAttendance,
  isShmpAttendancePortalRole,
  presentRowVisibleToCaller,
  productionShadowEmployees,
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
  personHref,
  presentHref,
  trackedAccessRole,
  usersVisibleToSupervisor,
  type DayFilter,
  type Emp,
} from "../hr/shared";

type HrListPerson = {
  id: string;
  name: string;
  role: string;
  email?: string;
  linkedUserId: string;
  productionWorker: boolean;
  productionEmployeeId: string;
};

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

function dubaiRange(todayOnly: boolean) {
  const to = dubaiToday();
  if (todayOnly) return { from: to, to };
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    from: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(start),
    to,
  };
}

function hrMarkId(person: HrListPerson) {
  return person.linkedUserId ? `portal:${person.linkedUserId}` : `staff:${person.id}`;
}

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
  const canMark = shmpActionOn(user?.customAccess, "attendance", "attendance.create");
  const canEditAttendance =
    shmpActionOn(user?.customAccess, "attendance", "attendance.update")
    && shmpActionOn(user?.customAccess, "attendance", "editExisting");
  const canFine = shmpActionOn(user?.customAccess, "attendance", "fines.create");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const dayFilter = parseHrDayFilter(searchParams.get("filter"));
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(true);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [users, setUsers] = useState<ShmpAccessUser[]>([]);
  const [hrStaff, setHrStaff] = useState<HrListPerson[]>([]);
  const [staffMarks, setStaffMarks] = useState<HrStaffAttendanceMark[]>([]);
  const [holidayOverrides, setHolidayOverrides] = useState<
    Array<{ salesId: string; name: string; date: string; status: string }>
  >([]);
  const [attendance, setAttendance] = useState<ShmpAttendanceRow[]>([]);
  const [presentToday, setPresentToday] = useState<ShmpPresentTodayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [markModalOpen, setMarkModalOpen] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [overridePeople, setOverridePeople] = useState<string[]>([]);
  const [overrideStatus, setOverrideStatus] = useState("present");
  const [overrideLeaveType, setOverrideLeaveType] = useState<"annual" | "sick">(
    "annual",
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDate, setOverrideDate] = useState(dubaiToday);
  const [overrideEndDate, setOverrideEndDate] = useState(dubaiToday);

  const [leaveAnnual, setLeaveAnnual] = useState("");
  const [leaveSick, setLeaveSick] = useState("");
  const [savingLeave, setSavingLeave] = useState(false);
  const [finePerson, setFinePerson] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineDate, setFineDate] = useState(dubaiToday);
  const [fineReason, setFineReason] = useState("");
  const [fineOpen, setFineOpen] = useState(false);
  const [savingFine, setSavingFine] = useState(false);
  const [selectedLeaveKeys, setSelectedLeaveKeys] = useState<string[]>([]);
  const [leaveListQuery, setLeaveListQuery] = useState("");
  const [portalLeave, setPortalLeave] = useState<
    Record<string, PortalLeaveEntitlement>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, accessUsers, hr] = await Promise.all([
        shmpEmployees(undefined, { for: "attendance" }) as Promise<Emp[]>,
        shmpAccessUsers().catch(() => [] as ShmpAccessUser[]),
        user?.id
          ? getHrStaff(user.id, { scope: "shmp" }).catch(() => ({ staff: [] }))
          : Promise.resolve({ staff: [] }),
      ]);
      const workers = Array.isArray(list) ? list : [];
      const portal = (
        supervisor ? usersVisibleToSupervisor(accessUsers) : accessUsers
      ).filter((row) => isShmpAttendancePortalRole(row.role));
      const hrPeople = addedHrStaffOnly(hr.staff || [])
        .map((row) => ({
          id: row.id,
          name: row.hrProfile?.visaName || row.name || "Staff",
          role: row.role && row.role !== "Staff" ? row.role : "Staff",
          email: row.email,
          linkedUserId: row.linkedUserId || "",
          productionWorker: row.hrProfile?.productionWorker === true,
          productionEmployeeId: row.hrProfile?.productionEmployeeId
            ? String(row.hrProfile.productionEmployeeId)
            : "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const shadows = productionShadowEmployees(workers, hrPeople);
      const shadowIds = new Set(shadows.map((row) => row._id));
      setEmployees(workers.filter((row) => !shadowIds.has(row._id)));
      setUsers(portal);
      setHrStaff(hrPeople);
      const hrLoginIds = new Set(
        hrPeople.map((person) => person.linkedUserId).filter(Boolean),
      );
      setLoading(false);
      const range = rangeFor(todayOnly);
      const portalIds = portal.map((row) => row._id);
      const supervisorIds = new Set(portalIds);
      const markWindow = dubaiRange(todayOnly);
      const [att, present, portalAtt, marks, overrideData] = await Promise.all([
        shmpAttendance({
          mine: "0",
          from: range.from,
          to: range.to,
        }).catch(() => [] as ShmpAttendanceRow[]),
        shmpPresentToday().catch(() => [] as ShmpPresentTodayRow[]),
        user?.id
          ? getAdminAttendance({
              userId: user.id,
              from: range.from.slice(0, 10),
              to: range.to.slice(0, 10),
            }).catch(() => ({ attendance: [] as AttendanceRecord[] }))
          : Promise.resolve({ attendance: [] as AttendanceRecord[] }),
        user?.id
          ? getHrStaffAttendance(user.id, "shmp", markWindow.from, markWindow.to).catch(
              () => ({ marks: [] as HrStaffAttendanceMark[] }),
            )
          : Promise.resolve({ marks: [] as HrStaffAttendanceMark[] }),
        user?.id
          ? getAttendanceOverrides(user.id, markWindow.from, markWindow.to).catch(
              () => ({ overrides: [] }),
            )
          : Promise.resolve({ overrides: [] }),
      ]);
      const workerRows = (Array.isArray(att) ? att : []).filter((row) => {
        const id = attendanceEmployeeId(row);
        return !id || !shadowIds.has(id);
      });
      const supervisorRows: ShmpAttendanceRow[] = (portalAtt.attendance || [])
        .filter((row) => {
          const id = attendanceRecordUserId(row.sales);
          return supervisorIds.has(id) || hrLoginIds.has(id);
        })
        .map((row) => {
          const sales = row.sales && typeof row.sales === "object" ? row.sales : null;
          return {
            _id: row._id,
            status: row.checkOutAt ? "checked_out" : "present",
            date: row.date,
            checkInAt: row.checkInAt,
            checkOutAt: row.checkOutAt,
            source: "checkin",
            user: {
              _id: attendanceRecordUserId(row.sales),
              name: sales?.name || sales?.email || "Supervisor",
              role: "Supervisor",
            },
          };
        });
      const seen = new Set(workerRows.map((row) => row._id).filter(Boolean));
      setAttendance([
        ...workerRows,
        ...supervisorRows.filter((row) => !row._id || !seen.has(row._id)),
      ]);
      const shadowNames = new Set(
        shadows
          .map((row) => (row.name || "").trim().replace(/\s+/g, " ").toLowerCase())
          .filter(Boolean),
      );
      setPresentToday(
        (Array.isArray(present) ? present : []).filter((row) => {
          if (!(presentRowVisibleToCaller(row, supervisor) || hrLoginIds.has(row._id))) {
            return false;
          }
          if (row.kind !== "worker") return true;
          const name = (row.name || "").trim().replace(/\s+/g, " ").toLowerCase();
          return !name || !shadowNames.has(name);
        }),
      );
      setStaffMarks(marks.marks || []);
      setHolidayOverrides(
        (overrideData.overrides || [])
          .map((row) => {
            const sales = row.sales && typeof row.sales === "object" ? row.sales : null;
            return {
              salesId: sales ? String(sales._id || "") : String(row.sales || ""),
              name: sales?.name || "Staff",
              date: attendanceDayKey(row.date),
              status: String(row.status || ""),
            };
          })
          .filter((row) => row.salesId && row.date),
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
  }, [supervisor, todayOnly, user]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const term = query.trim().toLowerCase();
  const today = dubaiToday();
  const hrOnlyAll = useMemo(
    () =>
      hrPeopleMissingFromAttendance(hrStaff, [
        ...employees.map((emp) => ({ id: emp._id, name: emp.name })),
        ...users.map((accessUser) => ({ id: accessUser._id, name: accessUser.name })),
        ...presentToday.map((row) => ({ id: row._id, name: row.name })),
      ]),
    [employees, hrStaff, presentToday, users],
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

  function personIdForPresent(row: (typeof presentToday)[number], kind: "worker" | "portal") {
    if (row.personId) return row.personId;
    const name = (row.name || "").trim().toLowerCase();
    if (kind === "worker") {
      return (
        employees.find((emp) => emp._id === row._id)?._id ||
        employees.find((emp) => (emp.name || "").trim().toLowerCase() === name)?._id ||
        row._id
      );
    }
    return (
      users.find((accessUser) => accessUser._id === row._id)?._id ||
      users.find((accessUser) => (accessUser.name || "").trim().toLowerCase() === name)?._id ||
      row._id
    );
  }

  const presentWorkerIds = useMemo(
    () =>
      new Set(
        presentToday
          .filter((row) => row.kind === "worker")
          .map((row) => personIdForPresent(row, "worker")),
      ),
    [employees, presentToday, users],
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

  const awayToday = useMemo(() => {
    const people: Array<{
      id: string;
      hrefKind: "worker" | "user" | "staff";
      name: string;
      meta: string;
      away: "holiday" | "annual" | "sick";
    }> = [];
    const seen = new Set<string>();
    function add(person: (typeof people)[number], also?: string) {
      if (!person.id || seen.has(person.id)) {
        if (also) seen.add(also);
        return;
      }
      seen.add(person.id);
      if (also) seen.add(also);
      people.push(person);
    }
    for (const row of presentToday) {
      const away = personAwayKind(row.status);
      if (!away) continue;
      add({
        id: row._id,
        hrefKind: row.kind === "portal" ? "user" : "worker",
        name: row.name,
        meta: awayLabel(away),
        away,
      });
    }
    for (const row of attendance) {
      const away = personAwayKind(String(row.status || ""), row.leaveType);
      if (!away) continue;
      if (!todayOnly && attendanceDayKey(row.date) !== today) continue;
      const id = attendanceEmployeeId(row);
      if (!id) continue;
      add({
        id,
        hrefKind: row.user ? "user" : "worker",
        name: attendanceEmployeeName(row),
        meta: awayLabel(away),
        away,
      });
    }
    for (const row of holidayOverrides) {
      const away = row.date === today ? personAwayKind(row.status) : null;
      if (!away) continue;
      const portal = users.find((accessUser) => accessUser._id === row.salesId);
      const staff = hrStaff.find((person) => person.linkedUserId === row.salesId);
      const hrefKind = portal || !staff ? "user" : "staff";
      add(
        {
          id: hrefKind === "staff" && staff ? staff.id : row.salesId,
          hrefKind,
          name: portal?.name || portal?.email || staff?.name || row.name,
          meta: awayLabel(away),
          away,
        },
        row.salesId,
      );
    }
    for (const person of hrOnlyAll) {
      const mark = staffMarks.find((row) => row.staffId === person.id && row.date === today);
      const away = personAwayKind(mark?.status, mark?.leaveType);
      if (!away) continue;
      add(
        {
          id: person.id,
          hrefKind: "staff",
          name: person.name,
          meta: awayLabel(away),
          away,
        },
        person.linkedUserId,
      );
    }
    return people;
  }, [attendance, holidayOverrides, hrOnlyAll, hrStaff, presentToday, staffMarks, today, todayOnly, users]);

  const awayIds = useMemo(() => {
    const ids = new Set(awayToday.map((person) => person.id));
    for (const person of hrStaff) {
      if (!person.linkedUserId) continue;
      if (ids.has(person.id)) ids.add(person.linkedUserId);
      if (ids.has(person.linkedUserId)) ids.add(person.id);
    }
    for (const row of holidayOverrides) {
      if (row.date === today && personAwayKind(row.status)) ids.add(row.salesId);
    }
    return ids;
  }, [awayToday, holidayOverrides, hrStaff, today]);

  const leavePeople = useMemo(
    () =>
      awayToday
        .filter((person) => matchesQuery(term, [person.name, person.meta]))
        .map((person) => ({
          id: person.id,
          href: personHref(person.hrefKind, person.id),
          name: person.name,
          meta: person.meta,
          status: person.away === "holiday" ? ("holiday" as const) : ("leave" as const),
        })),
    [awayToday, term],
  );

  const presentPeople = useMemo(
    () =>
      presentToday.filter((row) =>
        matchesQuery(term, [row.name, row.role, row.designation]),
      ),
    [presentToday, term],
  );

  const absentRoster = useMemo(() => {
    const people: Array<{
      id: string;
      href: string;
      name: string;
      meta?: string;
    }> = [];
    for (const emp of employees) {
      const status = attendanceByEmployeeId.get(emp._id);
      if (awayIds.has(emp._id) || status === "leave" || presentWorkerIds.has(emp._id)) continue;
      if (status !== "absent" && status) continue;
      people.push({
        id: emp._id,
        href: personHref("worker", emp._id),
        name: emp.name,
        meta: emp.designation || "Worker",
      });
    }
    const presentPortalIds = new Set(
      presentToday
        .filter((row) => row.kind === "portal")
        .map((row) => personIdForPresent(row, "portal")),
    );
    for (const accessUser of users) {
      if (presentPortalIds.has(accessUser._id) || awayIds.has(accessUser._id)) continue;
      people.push({
        id: accessUser._id,
        href: personHref("user", accessUser._id),
        name: accessUser.name || accessUser.email || "Supervisor",
        meta: accessUser.role || "Supervisor",
      });
    }
    for (const person of hrOnlyAll) {
      const mark = staffMarks.find((row) => row.staffId === person.id && row.date === today);
      if (mark?.status === "present" || mark?.status === "leave" || mark?.status === "holiday") continue;
      if (awayIds.has(person.id) || (person.linkedUserId && awayIds.has(person.linkedUserId))) continue;
      if (person.linkedUserId && presentPortalIds.has(person.linkedUserId)) continue;
      people.push({
        id: person.id,
        href: personHref("staff", person.id),
        name: person.name,
        meta: person.role || "Staff",
      });
    }
    return people;
  }, [attendanceByEmployeeId, awayIds, employees, hrOnlyAll, presentToday, presentWorkerIds, staffMarks, today, users]);

  const absentPeople = useMemo(
    () =>
      absentRoster.filter((person) =>
        matchesQuery(term, [person.name, person.meta]),
      ),
    [absentRoster, term],
  );

  const daySummary = {
    total: employees.length + users.length + hrOnlyAll.length,
    present:
      presentToday.length +
      hrOnlyAll.filter((person) =>
        staffMarks.some(
          (row) => row.staffId === person.id && row.date === today && row.status === "present",
        ),
      ).length,
    absent: absentRoster.length,
  };

  const leaveCount = awayToday.length;

  const hrOnly = useMemo(
    () =>
      hrOnlyAll.filter((person) =>
        matchesQuery(term, [person.name, person.role, person.email]),
      ),
    [hrOnlyAll, term],
  );

  const markPeople = useMemo(() => {
    const workers = employees.map((emp) => ({
      id: `worker:${emp._id}`,
      label: `${emp.name} (Worker)`,
    }));
    const portal = users.map((accessUser) => ({
      id: `portal:${accessUser._id}`,
      label: `${accessUser.name || accessUser.email || "User"} (${accessUser.role})`,
    }));
    const staff = hrOnlyAll.map((person) => ({
      id: hrMarkId(person),
      label: `${person.name} (${person.role || "Staff"})`,
    }));
    const seen = new Set<string>();
    return [...workers, ...portal, ...staff].filter((person) => {
      if (seen.has(person.id)) return false;
      seen.add(person.id);
      return true;
    });
  }, [employees, hrOnlyAll, users]);

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
    if (savingOverride) return;
    setMarkModalOpen(false);
    setOverrideReason("");
    setOverridePeople([]);
    setMarkError(null);
  }

  function openMark(personId: string, status = "present") {
    const people = personId ? [personId] : [];
    setOverridePeople(people);
    setOverrideStatus(
      status === "holiday" && !holidayStatusAvailable(people) ? "present" : status,
    );
    setOverrideLeaveType("annual");
    setOverrideReason("");
    setOverrideDate(today);
    setOverrideEndDate(today);
    setMarkError(null);
    setMarkModalOpen(true);
  }

  async function saveAttendanceFor(personKey: string, date: string) {
    const separator = personKey.indexOf(":");
    const kind = separator === -1 ? "" : personKey.slice(0, separator);
    const id = separator === -1 ? personKey : personKey.slice(separator + 1);
    const saved = attendanceSaveStatus(overrideStatus);
    const status = saved.status;
    const reason = overrideReason.trim();
    if (kind === "staff") {
      if (!user?.id) throw new Error("Sign in again to mark attendance");
      await markHrStaffAttendance(user.id, id, {
        date,
        status,
        ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
        reason,
      });
      return;
    }
    if (kind === "portal") {
      if (!user?.id) throw new Error("Sign in again to mark portal attendance");
      await overrideSalesAttendance({
        userId: user.id,
        salesId: id,
        date,
        status,
        ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
        reason: reason || undefined,
      });
      return;
    }
    const emp = employees.find((row) => row._id === id);
    const companyId = companyOf(emp);
    if (!companyId) throw new Error("Selected worker has no company");
    await shmpOverrideAttendance({
      companyId,
      employeeId: id,
      date,
      newStatus: status,
      ...(saved.leaveType ? { leaveType: saved.leaveType } : {}),
      reason,
    });
  }

  async function onOverride(e: FormEvent) {
    e.preventDefault();
    const people = overridePeople.filter(Boolean);
    if (people.length === 0) {
      setMarkError("Select at least one person");
      return;
    }
    const dates = attendanceMarkSpan(overrideStatus)
      ? attendanceDatesInRange(overrideDate, overrideEndDate || overrideDate)
      : [overrideDate];
    if (!dates || dates.length === 0) {
      setMarkError("Choose a valid holiday range");
      return;
    }
    setSavingOverride(true);
    setMarkError(null);
    try {
      const jobs = people.flatMap((personKey) =>
        dates.map((date) => ({ personKey, date })),
      );
      const results = await mapWithLimit(jobs, 6, (job) =>
        saveAttendanceFor(job.personKey, job.date),
      );
      const failed = [
        ...new Set(
          results.flatMap((result, index) =>
            result.status === "rejected" ? [jobs[index].personKey] : [],
          ),
        ),
      ];
      const saved = people.length - failed.length;
      if (failed.length === 0) {
        toast(
          people.length === 1
            ? "Attendance saved"
            : `Attendance saved for ${people.length} people`,
          "success",
        );
        setMarkModalOpen(false);
        setOverrideReason("");
        setOverridePeople([]);
        setMarkError(null);
        await refresh();
        return;
      }
      setOverridePeople(failed);
      const first = results.find((result) => result.status === "rejected");
      const message =
        first?.status === "rejected" && first.reason instanceof Error
          ? first.reason.message
          : "Some attendance updates failed";
      setMarkError(
        saved > 0
          ? `Saved ${saved}. ${failed.length} still need a retry. ${message}`
          : message,
      );
      if (saved > 0) {
        toast(
          `Saved ${saved}. ${failed.length} ${failed.length === 1 ? "person" : "people"} still need a retry.`,
          "info",
        );
        await refresh();
      }
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setSavingOverride(false);
    }
  }

  function openFine(personId = "") {
    setFinePerson(personId);
    setFineAmount("");
    setFineDate(dubaiToday());
    setFineReason("");
    setFineOpen(true);
  }

  async function onSaveFine(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    const amount = Number(fineAmount);
    if (!finePerson || !Number.isFinite(amount) || amount <= 0 || !fineDate || !fineReason.trim()) {
      toast("Person, amount, date, and reason are required", "info");
      return;
    }
    const [rawKind, id] = finePerson.split(":");
    const kind = rawKind === "worker" ? "employee" : rawKind === "portal" ? "user" : "staff";
    setSavingFine(true);
    try {
      await recordHrFine(user.id, {
        kind,
        id,
        amount,
        date: fineDate,
        reason: fineReason.trim(),
      });
      toast("Fine recorded on this person's HR loans and fines", "success");
      setFineOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not record the fine", "error");
    } finally {
      setSavingFine(false);
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
        subtitle="Workers, supervisors, and everyone listed in HR. Mark or change attendance from here."
        actions={
          <div className="flex gap-2">
            {canFine ? (
            <SecondaryButton type="button" disabled={loading} onClick={() => openFine()}>
              Record a fine
            </SecondaryButton>
            ) : null}
            <SecondaryButton type="button" disabled={loading} onClick={() => void refresh()}>
              Refresh
            </SecondaryButton>
          </div>
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
          label="On leave or holiday"
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
          staff={hrOnly}
        />
      ) : recentRows.length === 0 && presentPeople.length === 0 && hrOnly.length === 0 ? (
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
                  Workers via fingerprint, supervisors via portal check-in, and HR staff marked here.
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                {todayOnly ? `${presentToday.length} present` : `${recentRows.length} records`}
              </p>
            </div>
            {todayOnly ? (
              presentPeople.length === 0 && hrOnly.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  {term
                    ? "No present people match that search."
                    : "No one marked present yet today."}
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {presentPeople.map((row) => (
                    <li
                      key={`${row.kind}-${row._id}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-line p-4"
                    >
                      <Link
                        href={presentHref(row, users, employees)}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.role}
                          {row.designation ? ` · ${row.designation}` : ""}
                        </p>
                        <p className="mt-2 text-sm font-medium text-slate-800">Present</p>
                        <p className="mt-1 text-sm text-slate-700">
                          Check in: {fmtDateTime(row.checkInAt)}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Check out: {fmtDateTime(row.checkOutAt)}
                        </p>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {canEditAttendance ? (
                        <button
                          type="button"
                          className="font-medium text-brand-dark underline"
                          onClick={() =>
                            openMark(
                              row.kind === "worker"
                                ? `worker:${personIdForPresent(row, "worker")}`
                                : `portal:${personIdForPresent(row, "portal")}`,
                              "present",
                            )
                          }
                        >
                          Edit
                        </button>
                        ) : null}
                        {canFine ? (
                        <button
                          type="button"
                          className="font-medium text-brand-dark underline"
                          onClick={() =>
                            openFine(
                              row.kind === "worker"
                                ? `worker:${personIdForPresent(row, "worker")}`
                                : `portal:${personIdForPresent(row, "portal")}`,
                            )
                          }
                        >
                          Fine
                        </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : recentRows.length === 0 && hrOnly.length === 0 ? (
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
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {String(row.status || "").replaceAll("_", " ") || "Recorded"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
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
            {hrOnly.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink">HR staff</h3>
                <ul className="mt-2 space-y-2">
                  {hrOnly.map((person) => {
                    const mark = staffMarks.find(
                      (row) => row.staffId === person.id && row.date === today,
                    );
                    const portal = person.linkedUserId
                      ? presentToday.find((row) => row._id === person.linkedUserId)
                      : undefined;
                    const statusLabel =
                      mark?.status === "present"
                        ? "Present"
                        : mark?.status === "holiday"
                          ? "Holiday"
                        : mark?.status === "absent"
                          ? "Absent"
                          : mark?.status === "leave"
                            ? mark.leaveType === "sick"
                              ? "Sick leave"
                              : "Annual leave"
                            : portal
                              ? "Present"
                              : person.linkedUserId
                                ? "Not checked in"
                                : "Not marked";
                    return (
                      <li
                        key={person.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-line p-4"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{person.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {person.role}
                            {person.email ? ` · ${person.email}` : ""}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{statusLabel}</p>
                          {portal ? (
                            <p className="mt-1 text-sm text-slate-700">
                              Check in: {fmtDateTime(portal.checkInAt)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <button
                            type="button"
                            className="font-medium text-brand-dark underline"
                            onClick={() => openMark(hrMarkId(person), mark?.status || "present")}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="font-medium text-brand-dark underline"
                            onClick={() => openFine(hrMarkId(person))}
                          >
                            Fine
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          {!supervisor && !dayFilter ? (
            <form
              onSubmit={onSaveLeave}
              className="rounded-2xl border border-line bg-white p-5"
            >
              <h2 className="font-semibold text-ink">Leave entitlements</h2>
              <p className="mt-1 text-xs text-slate-500">
                Select supervisors and workers, then set annual and sick leave days
                for everyone selected.
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

      {!loading && (canMark || canEditAttendance) ? (
        <button
          type="button"
          aria-label="Mark attendance"
          onClick={() => openMark("")}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-ink shadow-lg ring-1 ring-black/5 transition hover:bg-brand-dark hover:text-white lg:bottom-8 lg:right-8"
        >
          <Plus className="h-7 w-7" strokeWidth={2.25} />
        </button>
      ) : null}

      {fineOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-fine-title"
        >
          <form
            onSubmit={onSaveFine}
            className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-white p-5 shadow-lg"
          >
            <h2 id="record-fine-title" className="text-lg font-semibold text-ink">Record a fine</h2>
            <p className="text-xs text-slate-500">
              This is saved under that person&apos;s loans and fines in HR, and it is taken off SHMP payroll for the month of the fine.
            </p>
            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Person</span>
              <select
                required
                value={finePerson}
                onChange={(event) => setFinePerson(event.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a person</option>
                {markPeople.map((person) => (
                  <option key={person.id} value={person.id}>{person.label}</option>
                ))}
              </select>
            </label>
            <TextField
              label="Amount (AED)"
              type="number"
              min={0.01}
              step="0.01"
              required
              value={fineAmount}
              onChange={(event) => setFineAmount(event.target.value)}
            />
            <TextField
              label="Date"
              type="date"
              required
              value={fineDate}
              onChange={(event) => setFineDate(event.target.value)}
            />
            <TextField
              label="Reason"
              required
              value={fineReason}
              onChange={(event) => setFineReason(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <SecondaryButton type="button" disabled={savingFine} onClick={() => setFineOpen(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={savingFine}>
                {savingFine ? "Saving…" : "Save fine"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      <MarkAttendanceDialog
        multiple
        open={markModalOpen}
        description="Record present, absent, annual or sick leave, or a holiday range. Reason is optional."
        people={markPeople}
        selected={overridePeople}
        date={overrideDate}
        endDate={overrideEndDate}
        status={overrideStatus}
        leaveType={overrideLeaveType}
        reason={overrideReason}
        saving={savingOverride}
        error={markError}
        statusOptions={[
          { value: "present", label: "Present" },
          { value: "absent", label: "Absent" },
          { value: "leave", label: "Annual leave" },
          { value: "sick", label: "Sick leave" },
          { value: "holiday", label: "Holiday" },
        ]}
        onClose={closeMarkModal}
        onSelected={setOverridePeople}
        onDate={(value) => {
          setOverrideDate(value);
          if (overrideEndDate < value) setOverrideEndDate(value);
        }}
        onEndDate={setOverrideEndDate}
        onStatus={setOverrideStatus}
        onLeaveType={setOverrideLeaveType}
        onReason={setOverrideReason}
        onSubmit={onOverride}
      />
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
  staff = [],
}: {
  filter: DayFilter;
  workers: Emp[];
  present: ShmpPresentTodayRow[];
  absent: Array<{
    id: string;
    href: string;
    name: string;
    meta?: string;
  }>;
  leave: Array<{
    id: string;
    href: string;
    name: string;
    meta?: string;
    status: "leave" | "holiday";
  }>;
  users: ShmpAccessUser[];
  employees: Emp[];
  staff?: HrListPerson[];
}) {
  const title =
    filter === "total"
      ? "All staff"
      : filter === "present"
        ? "Present today"
        : filter === "absent"
          ? "Absent today"
          : "On leave or holiday";

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      {filter === "total" ? (
        workers.length + users.length + staff.length === 0 ? (
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
            {staff.map((person) => (
              <li key={`staff-${person.id}`}>
                <Link
                  href={personHref("staff", person.id)}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{person.name}</p>
                    <p className="text-xs text-slate-500">{person.role || "Staff"}</p>
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
            {absent.map((person) => (
              <li key={person.id}>
                <Link
                  href={person.href}
                  className="flex items-center justify-between gap-3 py-2.5 hover:underline"
                >
                  <div>
                    <p className="font-medium text-ink">{person.name}</p>
                    <p className="text-xs text-slate-500">{person.meta || "Staff"}</p>
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
          <p className="mt-3 text-sm text-slate-500">No one is on leave or holiday today.</p>
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
                  <StatusBadge status={row.status === "holiday" ? "holiday" : "leave"} />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** People shown in the STL HR module. Attendance uses this same roster. */
export const STL_HR_ROLES = ["Warehouse"] as const;

/** Portal logins shown on SHMP attendance. Workers are separate. */
export const SHMP_ATTENDANCE_PORTAL_ROLES = ["Supervisor"] as const;

export function isStlHrRole(role?: string | null) {
  return role === "Warehouse";
}

/** HR lists show people added as staff. Portal logins stay in user management. */
export function addedHrStaffOnly<T extends { kind?: string | null }>(rows: T[]) {
  return rows.filter((row) => row.kind === "staff");
}

export function isShmpAttendancePortalRole(role?: string | null) {
  return (SHMP_ATTENDANCE_PORTAL_ROLES as readonly string[]).includes(role || "");
}

export type StlHrRosterRow = {
  id: string;
  kind?: string | null;
  role?: string | null;
  linkedUserId?: string | null;
};

/** Warehouse logins plus added staff. Attendance keeps warehouse users; the HR list shows added staff only. */
export function stlHrPeopleForAttendance<T extends StlHrRosterRow>(rows: T[]) {
  return rows.filter((row) => row.kind === "staff" || isStlHrRole(row.role));
}

/** Portal login that can have a check-in, when this HR row has one. */
export function stlAttendanceLoginId(row: StlHrRosterRow) {
  if (row.kind === "staff") return String(row.linkedUserId || "");
  return String(row.id || "");
}

export type AttendanceListRef = {
  id: string;
  name?: string | null;
  linkedUserId?: string | null;
};

/** HR people who are not already listed by login id, staff id, or name. */
export function hrPeopleMissingFromAttendance<T extends AttendanceListRef>(
  hrPeople: T[],
  listed: Array<{ id?: string | null; name?: string | null }>,
) {
  const ids = new Set(
    listed.map((row) => String(row.id || "")).filter(Boolean),
  );
  const names = new Set(
    listed
      .map((row) => (row.name || "").trim().toLowerCase())
      .filter(Boolean),
  );
  return hrPeople.filter((person) => {
    if (person.linkedUserId && ids.has(String(person.linkedUserId))) return false;
    if (ids.has(person.id)) return false;
    const name = (person.name || "").trim().toLowerCase();
    return !name || !names.has(name);
  });
}

/** Supervisors may see factory workers and other supervisors, not sales. */
export function presentRowVisibleToSupervisor(row: {
  kind?: string | null;
  role?: string | null;
}) {
  if (row.kind === "worker") return true;
  return row.role === "Supervisor";
}

export function presentRowVisibleToCaller(
  row: { kind?: string | null; role?: string | null },
  supervisor: boolean,
) {
  if (row.kind === "worker") return true;
  if (supervisor) return presentRowVisibleToSupervisor(row);
  return isShmpAttendancePortalRole(row.role);
}

export function warehouseStaffLabel(isManager: boolean) {
  return isManager ? "Warehouse manager" : "Warehouse user";
}

export function attendanceRecordUserId(
  sales?: string | { _id?: string } | null,
) {
  if (!sales) return "";
  if (typeof sales === "string") return sales;
  return String(sales._id || "");
}

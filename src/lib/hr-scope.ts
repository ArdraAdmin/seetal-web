/** People shown in the STL HR module. Attendance uses this same roster. */
export const STL_HR_ROLES = ["Warehouse"] as const;

/** Portal logins shown in the SHMP HR module. Workers are separate. */
export const SHMP_HR_PORTAL_ROLES = ["Sales", "Supervisor"] as const;

/** Portal logins shown on SHMP attendance. Workers are separate. */
export const SHMP_ATTENDANCE_PORTAL_ROLES = ["Supervisor"] as const;

export function isStlHrRole(role?: string | null) {
  return role === "Warehouse";
}

export function isShmpHrPortalRole(role?: string | null) {
  return role === "Sales" || role === "Supervisor";
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

/** Same people the STL HR page lists. */
export function stlHrPeopleForAttendance<T extends StlHrRosterRow>(rows: T[]) {
  return rows.filter((row) => row.kind === "staff" || isStlHrRole(row.role));
}

/** Portal login that can have a check-in, when this HR row has one. */
export function stlAttendanceLoginId(row: StlHrRosterRow) {
  if (row.kind === "staff") return String(row.linkedUserId || "");
  return String(row.id || "");
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

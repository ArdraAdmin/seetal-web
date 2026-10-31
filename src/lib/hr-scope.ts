/** People shown in the STL HR and attendance modules. */
export const STL_HR_ROLES = ["Warehouse"] as const;

/** Portal logins shown in the SHMP HR and attendance modules. Workers are separate. */
export const SHMP_HR_PORTAL_ROLES = ["Sales", "Supervisor"] as const;

export function isStlHrRole(role?: string | null) {
  return role === "Warehouse";
}

export function isShmpHrPortalRole(role?: string | null) {
  return role === "Sales" || role === "Supervisor";
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
  return isShmpHrPortalRole(row.role);
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

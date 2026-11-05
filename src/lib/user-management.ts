export const ADMIN_USER_GROUPS = ["sales", "warehouse", "admins", "custom"] as const;

/** STL portal admins. Other Admin-role logins are not listed or counted here. */
export const PORTAL_ADMIN_EMAILS = ["lav@shrseetal.com", "admin@gmail.com"] as const;
export const SHMP_USER_GROUPS = ["supervisor", "workers", "custom"] as const;

export type UserManagementSide = "admin" | "shmp";
export type AdminUserGroup = (typeof ADMIN_USER_GROUPS)[number];
export type ShmpUserGroup = (typeof SHMP_USER_GROUPS)[number];
export type UserGroup = AdminUserGroup | ShmpUserGroup;

export const USER_GROUP_LABELS: Record<UserGroup, string> = {
  sales: "Sales",
  warehouse: "Warehouse",
  admins: "Admins",
  custom: "Custom",
  supervisor: "Supervisors",
  workers: "Workers",
};

export function userGroupsForSide(side: UserManagementSide): readonly UserGroup[] {
  return side === "admin" ? ADMIN_USER_GROUPS : SHMP_USER_GROUPS;
}

export function parseUserGroup(
  side: UserManagementSide,
  value: string | null | undefined,
): UserGroup {
  const groups = userGroupsForSide(side);
  if (value && (groups as readonly string[]).includes(value)) return value as UserGroup;
  return groups[0];
}

export function userManagementPath(side: UserManagementSide, group: UserGroup) {
  const prefix = side === "admin" ? "/admin/users" : "/shmp/users";
  return `${prefix}?group=${group}`;
}

/** Only user-management tabs may be used as a post-edit return path. */
export function parseReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  for (const side of ["admin", "shmp"] as const) {
    for (const group of userGroupsForSide(side)) {
      const path = userManagementPath(side, group);
      if (value === path) return path;
    }
  }
  return null;
}

export function withReturnTo(href: string, returnTo: string) {
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}returnTo=${encodeURIComponent(returnTo)}`;
}

export type DirectoryPerson = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  detail: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function peopleList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (record && Array.isArray(record.users)) return record.users;
  if (record && Array.isArray(record.employees)) return record.employees;
  return [];
}

export function isPortalAdminEmail(email: string | null | undefined) {
  const value = String(email || "").trim().toLowerCase();
  return (PORTAL_ADMIN_EMAILS as readonly string[]).includes(value);
}

export function readPortalAdmins(data: unknown): DirectoryPerson[] {
  const rows: DirectoryPerson[] = [];
  for (const item of peopleList(data)) {
    const row = asRecord(item);
    if (!row) continue;
    const id = text(row._id);
    const email = text(row.email);
    if (!id || !isPortalAdminEmail(email)) continue;
    const rowRole = text(row.role);
    if (rowRole && rowRole !== "Admin") continue;
    const field = asRecord(row.field);
    const admin = field ? asRecord(field.admin) : null;
    rows.push({
      id,
      name: text(row.name) || "Unnamed",
      email,
      mobile: text(row.mobileNumber),
      detail: admin?.isSuperAdmin === true ? "Super admin" : "Admin",
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function readAccessPeople(data: unknown, role: string): DirectoryPerson[] {
  const rows: DirectoryPerson[] = [];
  for (const item of peopleList(data)) {
    const row = asRecord(item);
    if (!row) continue;
    const id = text(row._id);
    if (!id) continue;
    const rowRole = text(row.role);
    if (rowRole && rowRole !== role) continue;
    rows.push({
      id,
      name: text(row.name) || "Unnamed",
      email: text(row.email),
      mobile: text(row.mobileNumber),
      detail: rowRole || role,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function readWorkers(data: unknown): DirectoryPerson[] {
  const rows: DirectoryPerson[] = [];
  for (const item of peopleList(data)) {
    const row = asRecord(item);
    if (!row) continue;
    const id = text(row._id);
    if (!id || row.isActive === false) continue;
    const designation = text(row.designation);
    const shift = text(row.defaultShift);
    const shiftLabel = shift
      ? shift.charAt(0).toUpperCase() + shift.slice(1)
      : "";
    rows.push({
      id,
      name: text(row.name) || "Unnamed",
      email: text(row.email),
      mobile: text(row.mobileNumber),
      detail: [designation || "Worker", shiftLabel].filter(Boolean).join(" · "),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

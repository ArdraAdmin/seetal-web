import type { AppEnvironment, AuthUser } from "./types";
import { normalizeEnvironments, homePathForEnvironment } from "./environment";

/** SHMP routes Supervisors may open (prefix match). All other /shmp paths are Admin-only. */
export const SUPERVISOR_SHMP_PREFIXES = [
  "/shmp/hr",
  "/shmp/attendance",
  "/shmp/production",
  "/shmp/orders",
  "/shmp/settings",
] as const;

export function supervisorShmpHome() {
  return "/shmp/hr";
}

export function canSupervisorAccessShmpPath(pathname: string) {
  return SUPERVISOR_SHMP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function homePathForRole(role?: string) {
  if (role === "Sales") return "/sales";
  if (role === "Warehouse") return "/warehouse";
  if (role === "Supervisor") return supervisorShmpHome();
  return "/admin";
}

export function areaPrefix(path: string) {
  return `/${path.split("/").filter(Boolean)[0] || ""}`;
}

/** Post-login destination considering multi-environment users. */
export function postLoginPath(user: AuthUser): string {
  if (user.role === "Sales") return "/sales/company";
  const envs = normalizeEnvironments(
    user.environments,
    user.role,
    user.isSuperAdmin,
  );
  if (envs.length > 1) return "/select-environment";
  if (envs.length === 1) {
    return homePathForEnvironment(envs[0] as AppEnvironment, user.role);
  }
  return homePathForRole(user.role);
}

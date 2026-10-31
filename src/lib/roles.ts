import type { AppEnvironment, AuthUser } from "./types";
import { firstAllowedPath } from "./custom-users";
import {
  normalizeEnvironments,
  homePathForEnvironment,
  SUPERVISOR_SHMP_HOME,
} from "./environment";

export {
  SUPERVISOR_SHMP_PREFIXES,
  canSupervisorAccessShmpPath,
} from "./supervisor-shmp-access";

export function supervisorShmpHome() {
  return SUPERVISOR_SHMP_HOME;
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
  if (user.customAccess) {
    if (envs.length > 1) return "/select-environment";
    return firstAllowedPath(user.customAccess, envs[0] ?? "stl") ?? "/no-access";
  }
  if (envs.length > 1) return "/select-environment";
  if (envs.length === 1) {
    return homePathForEnvironment(envs[0] as AppEnvironment, user.role);
  }
  return homePathForRole(user.role);
}

import type { AppEnvironment, AuthUser } from "./types";
import { normalizeEnvironments, homePathForEnvironment } from "./environment";

export function homePathForRole(role?: string) {
  if (role === "Sales") return "/sales";
  if (role === "Warehouse") return "/warehouse";
  if (role === "Supervisor") return "/shmp";
  return "/admin";
}

export function areaPrefix(path: string) {
  return `/${path.split("/").filter(Boolean)[0] || ""}`;
}

/** Post-login destination considering multi-environment users. */
export function postLoginPath(user: AuthUser): string {
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

import type { AuthUser } from "./types";
import { AUTH_COOKIE } from "./session";
import { clearSelectedSalesCompany } from "./sales-selected-company";
import {
  clearEnvironment,
  loadEnvironment,
  type AppEnvironment,
} from "./environment";

export { AUTH_COOKIE, parseAuthCookie } from "./session";
export { homePathForRole } from "./roles";

const STORAGE_KEY = "stl_auth";

export function getStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveAuth(user: AuthUser, environment?: AppEnvironment | null): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  const maxAge = 60 * 60 * 24 * 7;
  const env = environment ?? loadEnvironment();
  const payload = encodeURIComponent(
    JSON.stringify({
      token: user.token,
      role: user.role,
      id: user.id,
      name: user.name,
      email: user.email,
      environment: env || undefined,
      environments: user.environments || [],
    }),
  );
  document.cookie = `${AUTH_COOKIE}=${payload}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearSelectedSalesCompany();
  clearEnvironment();
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "Admin";
}

/** Tracking and attendance are limited to this admin account. */
const TRACKING_ADMIN_EMAIL = "lav@shrseetal.com";

export function isSuperAdmin(user: AuthUser | null): boolean {
  if (user?.role !== "Admin") return false;
  if (user.isSuperAdmin === true) return true;
  return (
    String(user.email || "")
      .trim()
      .toLowerCase() === TRACKING_ADMIN_EMAIL
  );
}

export function isSales(user: AuthUser | null): boolean {
  return user?.role === "Sales";
}

export function isWarehouse(user: AuthUser | null): boolean {
  return user?.role === "Warehouse";
}

export function isSupervisor(user: AuthUser | null): boolean {
  return user?.role === "Supervisor";
}

export function canAccessEnvironment(
  user: AuthUser | null,
  env: "stl" | "shmp",
): boolean {
  if (!user) return false;
  const envs: Array<"stl" | "shmp"> = user.environments?.length
    ? user.environments
    : user.role === "Supervisor"
      ? ["shmp"]
      : user.isSuperAdmin
        ? ["stl", "shmp"]
        : ["stl"];
  return envs.includes(env);
}

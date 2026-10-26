import type { AuthUser } from "./types";
import { AUTH_COOKIE } from "./session";
import { clearSelectedSalesCompany } from "./sales-selected-company";
import {
  clearEnvironment,
  loadEnvironment,
  normalizeEnvironments,
  type AppEnvironment,
} from "./environment";

export { AUTH_COOKIE, parseAuthCookie } from "./session";
export { homePathForRole } from "./roles";

const STORAGE_KEY = "stl_auth";

function withNormalizedEnvironments(user: AuthUser): AuthUser {
  const environments = normalizeEnvironments(
    user.environments,
    user.role,
    isSuperAdmin(user),
  );
  return { ...user, environments };
}

export function getStoredAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return withNormalizedEnvironments(JSON.parse(raw) as AuthUser);
  } catch {
    return null;
  }
}

export function saveAuth(user: AuthUser, environment?: AppEnvironment | null): void {
  const normalized = withNormalizedEnvironments(user);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  const maxAge = 60 * 60 * 24 * 7;
  const env = environment ?? loadEnvironment();
  const payload = encodeURIComponent(
    JSON.stringify({
      token: normalized.token,
      role: normalized.role,
      id: normalized.id,
      name: normalized.name,
      email: normalized.email,
      isSuperAdmin: isSuperAdmin(normalized),
      environment: env || undefined,
      environments: normalized.environments,
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

/** Tracking is limited to this admin account (email only — never API flags). */
export const TRACKING_ADMIN_EMAIL = "lav@shrseetal.com";

export function isTrackingAdmin(user: AuthUser | null): boolean {
  if (user?.role !== "Admin") return false;
  return (
    String(user.email || "")
      .trim()
      .toLowerCase() === TRACKING_ADMIN_EMAIL
  );
}

/** Broader super-admin (Sunday delivery, etc.) — email or API flag. */
export function isSuperAdmin(user: AuthUser | null): boolean {
  if (user?.role !== "Admin") return false;
  if (user.isSuperAdmin === true) return true;
  return isTrackingAdmin(user);
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
  return normalizeEnvironments(
    user.environments,
    user.role,
    isSuperAdmin(user),
  ).includes(env);
}

import type { AuthUser } from "./types";
import {
  AUTH_COOKIE,
  SESSION_CHECK_COOKIE,
  buildSessionCookie,
  encodeSessionCookie,
  parseAuthCookie,
} from "./session";
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

/** Never leave protected layouts spinning longer than this. */
export const SESSION_GATE_TIMEOUT_MS = 8_000;

/** Login URL that asks middleware to wipe a stale session cookie. */
export function loginReauthUrl(next?: string): string {
  const params = new URLSearchParams({ reauth: "1" });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${AUTH_COOKIE}=`));
}

/** Read the middleware session cookie from document.cookie (non-httpOnly). */
export function readAuthCookie(): ReturnType<typeof parseAuthCookie> {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE}=`));
  if (!raw) return null;
  return parseAuthCookie(raw.slice(AUTH_COOKIE.length + 1));
}

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
  const payload = encodeSessionCookie(
    buildSessionCookie({
      token: normalized.token,
      role: normalized.role,
      id: normalized.id,
      name: normalized.name,
      email: normalized.email,
      isSuperAdmin: isSuperAdmin(normalized),
      environment: env,
      environments: normalized.environments,
      customUser: Boolean(normalized.customAccess),
    }),
  );
  document.cookie = `${AUTH_COOKIE}=${payload}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  clearSelectedSalesCompany();
  clearEnvironment();
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  // Best-effort: httpOnly stl_session_ok is cleared by middleware on ?reauth=1.
  document.cookie = `${SESSION_CHECK_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

let endingSession = false;

/**
 * Clear local auth and hard-navigate to login so middleware cannot bounce a
 * leftover cookie back into a protected layout (infinite "Checking session…").
 */
export function endClientSession(next?: string): void {
  clearAuth();
  if (typeof window === "undefined") return;
  const dest = loginReauthUrl(next);
  if (endingSession) return;
  const onLogin =
    window.location.pathname === "/login" &&
    new URLSearchParams(window.location.search).get("reauth") === "1";
  if (onLogin && !hasAuthCookie()) {
    endingSession = false;
    return;
  }
  endingSession = true;
  window.location.replace(dest);
}

/** Allow a later sign-in in the same tab after a forced logout. */
export function resumeClientSession(): void {
  endingSession = false;
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

export function isLabelChecker(user: AuthUser | null): boolean {
  return user?.role === "LabelChecker";
}

export function isDriver(user: AuthUser | null): boolean {
  return user?.role === "Driver";
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

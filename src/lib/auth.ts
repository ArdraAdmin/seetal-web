import type { AuthUser } from "./types";
import { AUTH_COOKIE } from "./session";
import { clearSelectedSalesCompany } from "./sales-selected-company";

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

export function saveAuth(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  const maxAge = 60 * 60 * 24 * 7;
  const payload = encodeURIComponent(
    JSON.stringify({
      token: user.token,
      role: user.role,
      id: user.id,
      name: user.name,
      email: user.email,
    }),
  );
  document.cookie = `${AUTH_COOKIE}=${payload}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearSelectedSalesCompany();
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

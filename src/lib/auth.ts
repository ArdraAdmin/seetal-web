import type { AuthUser } from "./types";
import { AUTH_COOKIE } from "./session";

export { AUTH_COOKIE, parseAuthCookie } from "./session";

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
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "Admin";
}

export function isSales(user: AuthUser | null): boolean {
  return user?.role === "Sales";
}

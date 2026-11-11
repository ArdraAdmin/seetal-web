import type { CustomAccess } from "./custom-users";

export const AUTH_COOKIE = "stl_session";

/** Short-lived proof that /user/me accepted this browser session. */
export const SESSION_CHECK_COOKIE = "stl_session_ok";
export const SESSION_CHECK_MAX_AGE = 45;

const SESSION_REJECTED = "stl-session-rejected";
let sessionEnded = false;

/** The API uses 401 when a saved login is no longer allowed (archived or invalid). */
export function isRejectedSessionStatus(status: number): boolean {
  return status === 401;
}

/**
 * What to do with a /user/me response.
 * "unknown" means the check did not succeed; keep the session and try again.
 */
export function remoteSessionDecision(
  status: number | null,
): "reject" | "allow" | "unknown" {
  if (status !== null && status >= 200 && status < 300) return "allow";
  if (status !== null && isRejectedSessionStatus(status)) return "reject";
  return "unknown";
}

export function noteRejectedSession(status: number): void {
  if (!isRejectedSessionStatus(status) || typeof window === "undefined" || sessionEnded) {
    return;
  }
  sessionEnded = true;
  window.dispatchEvent(new Event(SESSION_REJECTED));
}

export function onRejectedSession(handler: () => void): () => void {
  window.addEventListener(SESSION_REJECTED, handler);
  return () => window.removeEventListener(SESSION_REJECTED, handler);
}

/** A new sign-in can replace an archived session in the same tab. */
export function resumeSession(): void {
  sessionEnded = false;
}

export function parseAuthCookie(value: string | undefined): {
  token?: string;
  role?: string;
  id?: string;
  name?: string;
  email?: string;
  isSuperAdmin?: boolean;
  environment?: string;
  environments?: string[];
  customAccess?: CustomAccess;
} | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

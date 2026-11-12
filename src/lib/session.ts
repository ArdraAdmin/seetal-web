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

export type SessionCookie = {
  token?: string;
  role?: string;
  id?: string;
  name?: string;
  email?: string;
  isSuperAdmin?: boolean;
  environment?: string;
  environments?: string[];
  /**
   * Custom accounts load their module grant after sign-in.
   * The grant itself stays out of this cookie so a full-access account
   * still fits in the browser's 4KB cookie limit.
   */
  customUser?: boolean;
  /** Older sessions stored the grant here. New sign-ins omit it. */
  customAccess?: CustomAccess;
};

export function buildSessionCookie(input: {
  token: string;
  role?: string;
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  environment?: string | null;
  environments?: string[];
  customUser?: boolean;
}): SessionCookie {
  return {
    token: input.token,
    role: input.role,
    id: input.id,
    name: input.name,
    email: input.email,
    isSuperAdmin: input.isSuperAdmin,
    ...(input.environment ? { environment: input.environment } : {}),
    environments: input.environments,
    ...(input.customUser ? { customUser: true } : {}),
  };
}

export function encodeSessionCookie(value: SessionCookie): string {
  return encodeURIComponent(JSON.stringify(value));
}

export function parseAuthCookie(value: string | undefined): SessionCookie | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

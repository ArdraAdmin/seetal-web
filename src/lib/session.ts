export const AUTH_COOKIE = "stl_session";

export function parseAuthCookie(value: string | undefined): {
  token?: string;
  role?: string;
  id?: string;
  name?: string;
  email?: string;
} | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

import { getStoredAuth } from "./auth";
import type { CustomAccess, CustomUserRecord } from "./custom-users";

export type CustomUserInput = {
  name: string;
  email: string;
  password?: string;
  companies: string[];
  modules: CustomAccess["modules"];
};

async function siteJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  const res = await fetch(path, {
    ...options,
    cache: "no-store",
    headers,
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (typeof body === "string" && body.trim()) message = body;
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (typeof error === "string" && error.trim()) message = error;
    }
    throw new Error(message);
  }
  return body as T;
}

export function listCustomUsers() {
  return siteJson<{ users: CustomUserRecord[] }>("/api/admin/custom-users");
}

export function getCustomUser(id: string) {
  return siteJson<{ user: CustomUserRecord }>(
    `/api/admin/custom-users/${encodeURIComponent(id)}`,
  );
}

export function createCustomUser(input: CustomUserInput) {
  return siteJson<{ user: CustomUserRecord }>("/api/admin/custom-users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCustomUser(id: string, input: CustomUserInput) {
  return siteJson<{ user: CustomUserRecord }>(
    `/api/admin/custom-users/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteCustomUser(id: string) {
  return siteJson<{ ok: boolean }>(
    `/api/admin/custom-users/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function getMyCustomAccess(): Promise<CustomAccess | null> {
  const data = await siteJson<{ access: CustomAccess | null }>(
    "/api/admin/custom-users/me",
  );
  return data.access;
}

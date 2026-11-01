import { describeApiError } from "./api-error-message";
import { getStoredAuth } from "./auth";
import type { CustomAccess, CustomUserRecord } from "./custom-users";

export type CustomUserInput = {
  name: string;
  email: string;
  password?: string;
  companies: string[];
  modules: CustomAccess["modules"];
};

const REMOTE_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

function apiBase(): string {
  return typeof window === "undefined" ? REMOTE_API_BASE : "/stl-api";
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const user = getStoredAuth();
  if (user?.token) {
    headers.set("Authorization", user.token);
    headers.set("auth-token", user.token);
  }
  const res = await fetch(`${apiBase()}${path}`, {
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
    throw new Error(
      describeApiError(body, text || res.statusText || `Request failed (${res.status})`),
    );
  }
  return body as T;
}

export function listCustomUsers() {
  return apiJson<{ users: CustomUserRecord[] }>("/admin/custom-users");
}

export function getCustomUser(id: string) {
  return apiJson<{ user: CustomUserRecord }>(
    `/admin/custom-users/${encodeURIComponent(id)}`,
  );
}

export function createCustomUser(input: CustomUserInput) {
  return apiJson<{ user: CustomUserRecord }>("/admin/custom-users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCustomUser(id: string, input: CustomUserInput) {
  return apiJson<{ user: CustomUserRecord }>(
    `/admin/custom-users/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function deleteCustomUser(id: string) {
  return apiJson<{ ok: boolean }>(
    `/admin/custom-users/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function getMyCustomAccess(): Promise<CustomAccess | null> {
  const data = await apiJson<{ access: CustomAccess | null }>(
    "/admin/custom-users/me",
  );
  return data.access;
}

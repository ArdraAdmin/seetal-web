import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  AUTH_COOKIE,
  clearAuth,
  getStoredAuth,
  hasAuthCookie,
  loginReauthUrl,
  readAuthCookie,
  saveAuth,
  SESSION_GATE_TIMEOUT_MS,
} from "./auth.ts";
import { encodeSessionCookie, buildSessionCookie } from "./session.ts";
import type { AuthUser } from "./types.ts";

const sampleUser: AuthUser = {
  id: "user-1",
  name: "Sales User",
  email: "sales@shrseetal.com",
  role: "Sales",
  token: "token-abc",
  environments: ["stl"],
};

describe("loginReauthUrl", () => {
  it("asks middleware to clear a stale session cookie", () => {
    assert.equal(loginReauthUrl(), "/login?reauth=1");
    assert.equal(
      loginReauthUrl("/sales"),
      "/login?reauth=1&next=%2Fsales",
    );
  });

  it("keeps the session gate timeout finite", () => {
    assert.equal(SESSION_GATE_TIMEOUT_MS > 0, true);
    assert.equal(SESSION_GATE_TIMEOUT_MS <= 15_000, true);
  });
});

describe("auth cookie and localStorage stay in sync", () => {
  const memory = new Map<string, string>();
  let cookieJar = "";

  beforeEach(() => {
    memory.clear();
    cookieJar = "";
    (globalThis as { window?: unknown }).window = globalThis;
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return cookieJar;
        },
        set cookie(value: string) {
          const [pair] = value.split(";");
          const eq = pair.indexOf("=");
          const name = pair.slice(0, eq);
          const raw = pair.slice(eq + 1);
          const parts = cookieJar
            ? cookieJar.split("; ").filter((part) => !part.startsWith(`${name}=`))
            : [];
          if (!value.includes("max-age=0")) {
            parts.push(`${name}=${raw}`);
          }
          cookieJar = parts.join("; ");
        },
      },
    });
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { document?: unknown }).document;
  });

  it("saveAuth writes both localStorage and the middleware cookie", () => {
    saveAuth(sampleUser, null);
    assert.equal(getStoredAuth()?.token, "token-abc");
    assert.equal(hasAuthCookie(), true);
    assert.equal(readAuthCookie()?.role, "Sales");
  });

  it("clearAuth removes a leftover cookie when localStorage is already empty", () => {
    const payload = encodeSessionCookie(
      buildSessionCookie({
        token: "stale-token",
        role: "Sales",
        id: "user-1",
        name: "Sales User",
        email: "sales@shrseetal.com",
        isSuperAdmin: false,
        environments: ["stl"],
      }),
    );
    cookieJar = `${AUTH_COOKIE}=${payload}`;
    assert.equal(getStoredAuth(), null);
    assert.equal(hasAuthCookie(), true);

    clearAuth();

    assert.equal(getStoredAuth(), null);
    assert.equal(hasAuthCookie(), false);
    assert.equal(readAuthCookie(), null);
  });
});

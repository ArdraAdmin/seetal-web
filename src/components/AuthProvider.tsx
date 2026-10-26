"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, login as apiLogin } from "@/lib/api";
import {
  canAccessEnvironment,
  clearAuth,
  getStoredAuth,
  saveAuth,
} from "@/lib/auth";
import { clearSelectedSalesCompany } from "@/lib/sales-selected-company";
import { postLoginPath, areaPrefix, homePathForRole } from "@/lib/roles";
import {
  clearEnvironment,
  homePathForEnvironment,
  loadEnvironment,
  saveEnvironment,
  type AppEnvironment,
} from "@/lib/environment";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  environment: AppEnvironment | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectEnvironment: (env: AppEnvironment) => void;
  clearSelectedEnvironment: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [environment, setEnvironment] = useState<AppEnvironment | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const stored = getStoredAuth();
      const env = loadEnvironment();
      if (!stored) {
        if (!cancelled) {
          setUser(null);
          setEnvironment(env);
          setLoading(false);
        }
        return;
      }
      // Refresh cookie so middleware sees normalized environments (fixes empty []).
      saveAuth(stored, env);
      if (!cancelled) {
        setUser(stored);
        setEnvironment(env);
      }
      try {
        const fresh = await fetchCurrentUser();
        if (cancelled) return;
        saveAuth(fresh, env);
        setUser(fresh);
      } catch {
        // Keep stored session if /user/me is unavailable (older API).
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const authUser = await apiLogin(email, password);
      if (!authUser?.token) {
        throw new Error("Sign-in failed");
      }
      clearEnvironment();
      clearSelectedSalesCompany();
      saveAuth(authUser, null);
      setUser(authUser);
      setEnvironment(null);
      const home = postLoginPath(authUser);
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && home !== "/select-environment") {
        const prefix = areaPrefix(home);
        if (next.startsWith(prefix)) {
          router.replace(next);
          return;
        }
      }
      router.replace(home);
    },
    [router],
  );

  const selectEnvironment = useCallback(
    (env: AppEnvironment) => {
      if (!user) return;
      if (!canAccessEnvironment(user, env)) {
        throw new Error(`No access to ${env.toUpperCase()}`);
      }
      saveEnvironment(env);
      saveAuth(user, env);
      setEnvironment(env);
      router.replace(homePathForEnvironment(env, user.role));
    },
    [router, user],
  );

  const clearSelectedEnvironment = useCallback(() => {
    clearEnvironment();
    setEnvironment(null);
    if (user) saveAuth(user, null);
    router.replace("/select-environment");
  }, [router, user]);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setEnvironment(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      loading,
      environment,
      login,
      logout,
      selectEnvironment,
      clearSelectedEnvironment,
    }),
    [
      user,
      loading,
      environment,
      login,
      logout,
      selectEnvironment,
      clearSelectedEnvironment,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Keep for any imports that still expect role home helper. */
export { homePathForRole };

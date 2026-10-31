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
import { getMyCustomAccess } from "@/lib/custom-users-api";
import { canCustomUserAccessPath, firstAllowedPath } from "@/lib/custom-users";
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
        let customAccess = stored.customAccess;
        try {
          customAccess = (await getMyCustomAccess()) ?? undefined;
        } catch {
          /* Keep the access already stored with this session. */
        }
        const next = { ...fresh, customAccess };
        saveAuth(next, env);
        setUser(next);
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
      const signedIn = await apiLogin(email, password);
      if (!signedIn?.token) {
        throw new Error("Sign-in failed");
      }
      clearEnvironment();
      clearSelectedSalesCompany();
      saveAuth(signedIn, null);
      let customAccess = signedIn.customAccess;
      try {
        customAccess = (await getMyCustomAccess()) ?? undefined;
      } catch {
        /* Sign-in still succeeds. Module limits refresh on the next load. */
      }
      const authUser = { ...signedIn, customAccess };
      saveAuth(authUser, null);
      setUser(authUser);
      setEnvironment(null);
      const home = postLoginPath(authUser);
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && home !== "/select-environment") {
        const allowed = authUser.customAccess
          ? canCustomUserAccessPath(authUser.customAccess, next)
          : next.startsWith(areaPrefix(home));
        if (allowed) {
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
      const dest = user.customAccess
        ? firstAllowedPath(user.customAccess, env)
        : homePathForEnvironment(env, user.role);
      if (!dest) {
        throw new Error(`No modules are enabled for ${env.toUpperCase()}`);
      }
      router.replace(dest);
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

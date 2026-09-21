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
import { login as apiLogin } from "@/lib/api";
import {
  clearAuth,
  getStoredAuth,
  isAdmin,
  isSales,
  saveAuth,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredAuth());
    setLoading(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const authUser = await apiLogin(email, password);
      if (!isAdmin(authUser) && !isSales(authUser)) {
        throw new Error("Only Admin and Sales users can access STL Web.");
      }
      saveAuth(authUser);
      setUser(authUser);
      const next = new URLSearchParams(window.location.search).get("next");
      if (isAdmin(authUser)) {
        router.replace(
          next && next.startsWith("/admin") ? next : "/admin",
        );
      } else {
        router.replace(
          next && next.startsWith("/sales") ? next : "/sales/approvals",
        );
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

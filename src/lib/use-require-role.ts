"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  SESSION_GATE_TIMEOUT_MS,
  endClientSession,
} from "@/lib/auth";
import type { UserRole } from "@/lib/types";

/**
 * Gate a protected layout on auth + role. Always resolves: either the user is
 * ready, or we hard-exit to login (including a timeout so we never spin forever).
 */
export function useRequireRole(roles: UserRole | UserRole[]) {
  const { user, loading } = useAuth();
  const allowed = Array.isArray(roles) ? roles : [roles];
  const ok = Boolean(user && allowed.includes(user.role));
  const checking = loading || !ok;
  const ending = useRef(false);

  useEffect(() => {
    if (loading || ok || ending.current) return;
    ending.current = true;
    endClientSession();
  }, [loading, ok]);

  useEffect(() => {
    if (!checking || ending.current) return;
    const timer = window.setTimeout(() => {
      if (ending.current) return;
      ending.current = true;
      endClientSession();
    }, SESSION_GATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [checking]);

  return { user, loading, ready: !loading && ok, checking };
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import {
  canCustomUserAccessPath,
  customHomePath,
  type AppSide,
} from "@/lib/custom-users";

export function CustomAccessGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const access = user?.customAccess;
  const blocked = Boolean(
    access && pathname && !canCustomUserAccessPath(access, pathname),
  );

  useEffect(() => {
    if (!access || !pathname || !blocked) return;
    const preferred: AppSide = pathname.startsWith("/shmp") ? "shmp" : "stl";
    const envs = preferred === "shmp" ? (["shmp", "stl"] as AppSide[]) : (["stl", "shmp"] as AppSide[]);
    router.replace(customHomePath(access, envs, preferred));
  }, [access, blocked, pathname, router]);

  if (blocked) {
    return <LoadingState label="Opening your modules…" />;
  }
  return children;
}

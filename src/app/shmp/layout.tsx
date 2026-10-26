"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ShmpShell } from "@/components/ShmpShell";
import { StaffCheckInGate } from "@/components/StaffCheckInGate";
import { canAccessEnvironment, isSupervisor } from "@/lib/auth";
import {
  canSupervisorAccessShmpPath,
  supervisorShmpHome,
} from "@/lib/roles";

export default function ShmpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supervisor = isSupervisor(user);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/shmp");
      return;
    }
    if (!canAccessEnvironment(user, "shmp")) {
      router.replace("/select-environment");
      return;
    }
    if (user.role !== "Admin" && user.role !== "Supervisor") {
      router.replace("/login");
      return;
    }
    if (
      isSupervisor(user) &&
      pathname &&
      !canSupervisorAccessShmpPath(pathname)
    ) {
      router.replace(supervisorShmpHome());
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  // Supervisors must check in at the start of the day; admins are not tracked.
  if (supervisor) {
    return (
      <StaffCheckInGate
        title="Check in to open SHMP"
        subtitle="Record your attendance for today, then continue to the portal."
      >
        <ShmpShell>{children}</ShmpShell>
      </StaffCheckInGate>
    );
  }

  return <ShmpShell>{children}</ShmpShell>;
}

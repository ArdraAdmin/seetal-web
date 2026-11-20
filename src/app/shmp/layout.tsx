"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShmpShell } from "@/components/ShmpShell";
import { CustomAccessGuard } from "@/components/CustomAccessGuard";
import { StaffCheckInGate } from "@/components/StaffCheckInGate";
import { canAccessEnvironment, isLabelChecker, isSupervisor } from "@/lib/auth";
import { canLabelCheckerAccessShmpPath, LABEL_CHECKER_SHMP_HOME } from "@/lib/label-checker-access";
import {
  canSupervisorAccessShmpPath,
  supervisorShmpHome,
} from "@/lib/roles";
import { useRequireRole } from "@/lib/use-require-role";

export default function ShmpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, ready } = useRequireRole([
    "Admin",
    "Supervisor",
    "LabelChecker",
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const supervisor = isSupervisor(user);
  const labelChecker = isLabelChecker(user);

  useEffect(() => {
    if (!ready || !user) return;
    if (!canAccessEnvironment(user, "shmp")) {
      router.replace("/select-environment");
      return;
    }
    if (
      isSupervisor(user) &&
      pathname &&
      !canSupervisorAccessShmpPath(pathname)
    ) {
      router.replace(supervisorShmpHome());
    }
    if (
      isLabelChecker(user) &&
      pathname &&
      !canLabelCheckerAccessShmpPath(pathname)
    ) {
      router.replace(LABEL_CHECKER_SHMP_HOME);
    }
  }, [user, ready, router, pathname, supervisor, labelChecker]);

  if (loading || !ready || !user) {
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
        <ShmpShell>
          <CustomAccessGuard>{children}</CustomAccessGuard>
        </ShmpShell>
      </StaffCheckInGate>
    );
  }

  return (
    <ShmpShell>
      <CustomAccessGuard>{children}</CustomAccessGuard>
    </ShmpShell>
  );
}

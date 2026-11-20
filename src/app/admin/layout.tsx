"use client";

import { AdminShell } from "@/components/AdminShell";
import { CustomAccessGuard } from "@/components/CustomAccessGuard";
import { LoadingState } from "@/components/ui";
import { useRequireRole } from "@/lib/use-require-role";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { checking } = useRequireRole("Admin");

  if (checking) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return (
    <AdminShell>
      <CustomAccessGuard>{children}</CustomAccessGuard>
    </AdminShell>
  );
}

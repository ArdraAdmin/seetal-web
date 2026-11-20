"use client";

import { DriverShell } from "@/components/DriverShell";
import { LoadingState } from "@/components/ui";
import { useRequireRole } from "@/lib/use-require-role";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { checking } = useRequireRole("Driver");

  if (checking) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return <DriverShell>{children}</DriverShell>;
}

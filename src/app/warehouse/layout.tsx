"use client";

import { WarehouseShell } from "@/components/WarehouseShell";
import { LoadingState } from "@/components/ui";
import { useRequireRole } from "@/lib/use-require-role";

export default function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { checking } = useRequireRole("Warehouse");

  if (checking) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return <WarehouseShell>{children}</WarehouseShell>;
}

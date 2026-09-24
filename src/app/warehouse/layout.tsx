"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WarehouseShell } from "@/components/WarehouseShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";

export default function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "Warehouse")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "Warehouse") {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return <WarehouseShell>{children}</WarehouseShell>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DriverShell } from "@/components/DriverShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "Driver")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "Driver") {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return <DriverShell>{children}</DriverShell>;
}

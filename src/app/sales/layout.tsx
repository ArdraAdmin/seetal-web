"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "Sales")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "Sales") {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  return <SalesShell>{children}</SalesShell>;
}

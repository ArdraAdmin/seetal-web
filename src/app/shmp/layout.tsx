"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { ShmpShell } from "@/components/ShmpShell";
import { canAccessEnvironment } from "@/lib/auth";

export default function ShmpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return <ShmpShell>{children}</ShmpShell>;
}

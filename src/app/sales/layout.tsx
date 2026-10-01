"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import { syncSalesInventory } from "@/lib/api";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.id || user.role !== "Sales") return;
    const userId = user.id;
    function sync() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void syncSalesInventory(userId);
    }
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, user?.role]);

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

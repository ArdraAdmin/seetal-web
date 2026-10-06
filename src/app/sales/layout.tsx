"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import { syncSalesInventory } from "@/lib/api";
import {
  hasSelectedSalesCompany,
  onSelectedSalesCompanyChange,
} from "@/lib/sales-selected-company";

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isCompanyPage = pathname === "/sales/company";
  const [companyReady, setCompanyReady] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    function refresh() {
      setHasCompany(hasSelectedSalesCompany());
      setCompanyReady(true);
    }
    refresh();
    return onSelectedSalesCompanyChange(refresh);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || user.role !== "Sales" || !hasCompany) return;
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
  }, [user?.id, user?.role, hasCompany]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "Sales")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || user.role !== "Sales" || !companyReady) return;
    if (!hasCompany && !isCompanyPage) {
      router.replace("/sales/company");
    }
  }, [loading, user, companyReady, hasCompany, isCompanyPage, router]);

  if (loading || !user || user.role !== "Sales" || !companyReady) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  if (!hasCompany && !isCompanyPage) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Opening company selection…" />
      </div>
    );
  }

  if (isCompanyPage) {
    return (
      <div className="min-h-dvh bg-background px-4 py-5 sm:px-6 sm:py-8">
        {children}
      </div>
    );
  }

  return <SalesShell>{children}</SalesShell>;
}

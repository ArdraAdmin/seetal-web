"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import { syncSalesInventory } from "@/lib/api";
import {
  promptEnableLocationOnce,
  resumeTrackingIfCheckedIn,
} from "@/lib/sales-location";
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
  const needsCompany = pathname.startsWith("/sales/stores");
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
    void promptEnableLocationOnce();
    void resumeTrackingIfCheckedIn(userId);
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
    if (!hasCompany && needsCompany) {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/sales/company?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, companyReady, hasCompany, needsCompany, pathname, router]);

  if (loading || !user || user.role !== "Sales") {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  if (needsCompany && (!companyReady || !hasCompany)) {
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

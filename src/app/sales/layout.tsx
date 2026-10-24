"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import {
  getSalesAttendanceToday,
  syncSalesInventory,
  warmCompanyDirectory,
} from "@/lib/api";
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
  const isAttendancePage = pathname === "/sales/attendance";
  const needsCompany = pathname.startsWith("/sales/stores");
  const [companyReady, setCompanyReady] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const refreshAttendance = useCallback(async () => {
    if (!user?.id || user.role !== "Sales") return;
    try {
      const data = await getSalesAttendanceToday(user.id);
      setCheckedIn(!!data.checkedIn);
    } catch {
      setCheckedIn(false);
    } finally {
      setAttendanceReady(true);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    function refresh() {
      setHasCompany(hasSelectedSalesCompany());
      setCompanyReady(true);
    }
    refresh();
    return onSelectedSalesCompanyChange(refresh);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || user.role !== "Sales") return;
    void warmCompanyDirectory().catch(() => {});
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.id || user.role !== "Sales") return;
    setAttendanceReady(false);
    void refreshAttendance();
    const onChanged = () => {
      void refreshAttendance();
    };
    window.addEventListener("stl-sales-attendance-changed", onChanged);
    window.addEventListener("focus", onChanged);
    return () => {
      window.removeEventListener("stl-sales-attendance-changed", onChanged);
      window.removeEventListener("focus", onChanged);
    };
  }, [user?.id, user?.role, refreshAttendance]);

  useEffect(() => {
    if (!user?.id || user.role !== "Sales" || !hasCompany || !checkedIn) return;
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
  }, [user?.id, user?.role, hasCompany, checkedIn]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "Sales")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || user.role !== "Sales" || !attendanceReady) return;
    if (!checkedIn && !isAttendancePage) {
      router.replace("/sales/attendance");
    }
  }, [
    loading,
    user,
    attendanceReady,
    checkedIn,
    isAttendancePage,
    router,
  ]);

  useEffect(() => {
    if (loading || !user || user.role !== "Sales" || !companyReady) return;
    if (!checkedIn) return;
    if (!hasCompany && needsCompany) {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/sales/company?next=${encodeURIComponent(next)}`);
    }
  }, [
    loading,
    user,
    companyReady,
    hasCompany,
    needsCompany,
    pathname,
    router,
    checkedIn,
  ]);

  if (loading || !user || user.role !== "Sales") {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking session…" />
      </div>
    );
  }

  if (!attendanceReady) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Checking attendance…" />
      </div>
    );
  }

  if (!checkedIn && !isAttendancePage) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState label="Opening check-in…" />
      </div>
    );
  }

  if (!checkedIn && isAttendancePage) {
    return <SalesShell attendanceLocked>{children}</SalesShell>;
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

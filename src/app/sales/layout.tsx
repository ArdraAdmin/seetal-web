"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SalesShell } from "@/components/SalesShell";
import { useAuth } from "@/components/AuthProvider";
import { LoadingState } from "@/components/ui";
import {
  getSalesAttendanceToday,
  selectSalesCompany,
  syncSalesInventory,
  warmCompanyDirectory,
} from "@/lib/api";
import {
  promptEnableLocationOnce,
  resumeTrackingIfCheckedIn,
} from "@/lib/sales-location";
import {
  hasSelectedSalesCompany,
  hasSelectedSalesWorkspace,
  loadSalesWorkspace,
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
  const needsWorkspace =
    pathname === "/sales" || pathname.startsWith("/sales/stores");
  const needsInventory = pathname.startsWith("/sales/stores");
  const [companyReady, setCompanyReady] = useState(false);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [hasInventory, setHasInventory] = useState(false);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const bindingSarvah = useRef(false);

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
      setHasWorkspace(hasSelectedSalesWorkspace());
      setHasInventory(hasSelectedSalesCompany());
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
    if (!user?.id || user.role !== "Sales" || !hasInventory || !checkedIn) return;
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
  }, [user?.id, user?.role, hasInventory, checkedIn]);

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
  }, [loading, user, attendanceReady, checkedIn, isAttendancePage, router]);

  useEffect(() => {
    if (loading || !user || user.role !== "Sales" || !companyReady) return;
    if (!checkedIn) return;
    if (hasInventory) bindingSarvah.current = false;
    if (!hasWorkspace && needsWorkspace) {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/sales/company?next=${encodeURIComponent(next)}`);
      return;
    }
    if (needsInventory && !hasInventory) {
      const next = `${pathname}${window.location.search}`;
      if (loadSalesWorkspace() === "sarvah") {
        if (!bindingSarvah.current) {
          bindingSarvah.current = true;
          void selectSalesCompany(user.id, "sarvah").catch(() => {
            bindingSarvah.current = false;
            router.replace(`/sales/company?next=${encodeURIComponent(next)}`);
          });
        }
        return;
      }
      router.replace(`/sales/company?next=${encodeURIComponent(next)}`);
    }
  }, [
    loading,
    user,
    companyReady,
    hasWorkspace,
    hasInventory,
    needsWorkspace,
    needsInventory,
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

  if (
    (needsWorkspace && (!companyReady || !hasWorkspace)) ||
    (needsInventory && (!companyReady || !hasInventory))
  ) {
    return (
      <div className="min-h-dvh bg-background p-4 sm:p-6">
        <LoadingState
          label={
            needsInventory && hasWorkspace && !hasInventory
              ? "Opening inventory…"
              : "Opening company selection…"
          }
        />
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

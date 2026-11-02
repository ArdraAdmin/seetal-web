"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  CalendarX,
  FileBarChart,
  Folders,
  KeyRound,
  PackageX,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Image as ImageIcon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  Target,
  Truck,
  UserSquare,
  UserPlus,
  Warehouse,
  X,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "./AuthProvider";
import { getApprovalQueue } from "@/lib/api";
import {
  APPROVALS_CHANGED_EVENT,
  pendingApprovalCount,
} from "@/lib/approval";
import { canAccessEnvironment, isSuperAdmin, isTrackingAdmin } from "@/lib/auth";
import { portalFieldVisible, sellingModuleVisible } from "@/lib/custom-users";
import { navItemActive } from "@/lib/nav-active";
import {
  isSettingsNavHref,
  isTrackingUnlocked,
  onTrackingUnlockChange,
  registerTrackingSettingsClick,
} from "@/lib/tracking-unlock";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  match?: string[];
  moduleId?: string;
  /** Hidden unless this field of moduleId is granted. */
  fieldId?: string;
  superAdminOnly?: boolean;
  /** Tracking — lav@shrseetal.com only, after 5 Settings clicks. */
  trackingOnly?: boolean;
  /** Only lav@shrseetal.com (module permissions owner). */
  lavOnly?: boolean;
  /** Hidden from custom users. Full admins only. */
  fullAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "KPI dashboard", icon: LayoutDashboard, moduleId: "dashboard" },
  {
    href: "/admin/drivers-vehicles",
    label: "Drivers & vehicles",
    icon: Truck,
    moduleId: "drivers-vehicles",
    match: ["/admin/drivers-vehicles", "/admin/drivers", "/admin/vehicles"],
  },
  { href: "/admin/stores", label: "Stores", icon: Store, moduleId: "stores" },
  { href: "/admin/inventory", label: "Inventory", icon: Package, moduleId: "inventory" },
  { href: "/admin/catalog", label: "Catalog", icon: ImageIcon, moduleId: "catalog" },
  {
    href: "/admin/stock-transfer",
    label: "Stock transfer",
    icon: ArrowLeftRight,
    moduleId: "stock-transfer",
  },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, moduleId: "approvals" },
  { href: "/admin/leave", label: "Leave", icon: CalendarDays, moduleId: "leave" },
  {
    href: "/admin/tracking",
    label: "Tracking",
    icon: MapPinned,
    trackingOnly: true,
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    icon: CalendarDays,
    moduleId: "attendance",
    superAdminOnly: true,
  },
  {
    href: "/admin/attendance-reports",
    label: "Attendance reports",
    icon: FileBarChart,
    moduleId: "attendance-reports",
  },
  {
    href: "/admin/attendance-override",
    label: "Attendance override",
    icon: CalendarX,
    moduleId: "attendance-override",
    superAdminOnly: true,
  },
  {
    href: "/admin/leave-settings",
    label: "Leave settings",
    icon: CalendarClock,
    moduleId: "leave-settings",
  },
  { href: "/admin/hr", label: "HR", icon: UserSquare, moduleId: "hr" },
  {
    href: "/admin/hr/payroll",
    label: "Payroll settings",
    icon: Banknote,
    moduleId: "hr",
    fieldId: "salary",
  },
  {
    href: "/admin/driver-deliveries",
    label: "Driver deliveries",
    icon: Truck,
    moduleId: "driver-deliveries",
  },
  { href: "/admin/sales-lost", label: "Sales lost", icon: PackageX, moduleId: "sales-lost" },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: KeyRound,
    lavOnly: true,
  },
  {
    href: "/admin/users",
    label: "User management",
    icon: UserPlus,
    match: ["/admin/users"],
    fullAdminOnly: true,
  },
  { href: "/admin/targets", label: "Sales targets", icon: Target, moduleId: "targets" },
  { href: "/admin/grv", label: "GRV management", icon: RotateCcw, moduleId: "grv" },
  { href: "/admin/categories", label: "Categories", icon: Folders, moduleId: "categories" },
  { href: "/admin/payments", label: "Payments", icon: Banknote, moduleId: "payments" },
  { href: "/admin/warehouse", label: "Warehouse", icon: Warehouse, moduleId: "warehouse" },
  { href: "/admin/settings", label: "Settings", icon: Settings, moduleId: "settings" },
];

const COLLAPSE_KEY = "stl_sidebar_collapsed";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout, clearSelectedEnvironment } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);
  const [trackingUnlocked, setTrackingUnlocked] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setCollapseReady(true);
  }, []);

  useEffect(() => {
    setTrackingUnlocked(isTrackingUnlocked());
    return onTrackingUnlockChange(() => {
      setTrackingUnlocked(isTrackingUnlocked());
    });
  }, []);

  useEffect(() => {
    if (!collapseReady) return;
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed, collapseReady]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", mobileOpen);
    return () => document.body.classList.remove("nav-open");
  }, [mobileOpen]);

  const initials = (user?.name || "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const isLav =
    String(user?.email || "").trim().toLowerCase() === "lav@shrseetal.com";
  const canSeeTracking = isTrackingAdmin(user) && trackingUnlocked;
  const navItems = NAV.filter((item) => {
    if (user?.customAccess) {
      if (!item.moduleId || !sellingModuleVisible(user.customAccess, item.moduleId)) {
        return false;
      }
      if (
        item.fieldId &&
        !portalFieldVisible(user.customAccess, "selling", item.moduleId, item.fieldId)
      ) {
        return false;
      }
      return true;
    }
    if (item.trackingOnly) return canSeeTracking;
    if (item.superAdminOnly) return isSuperAdmin(user);
    if (item.lavOnly) return isLav;
    return true;
  });
  const showApprovals = navItems.some((item) => item.href === "/admin/approvals");
  const showSettings =
    !user?.customAccess || sellingModuleVisible(user.customAccess, "settings");

  useEffect(() => {
    if (!showApprovals) {
      setPendingApprovals(0);
      return;
    }
    let cancelled = false;

    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const orders = await getApprovalQueue();
        if (!cancelled) setPendingApprovals(pendingApprovalCount(orders));
      } catch {
        // Keep the last count so a failed refresh does not hide a known queue.
      }
    }

    function onChanged(event: Event) {
      const count = (event as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof count === "number") {
        setPendingApprovals(count);
        return;
      }
      void refresh();
    }

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener(APPROVALS_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(APPROVALS_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [showApprovals]);

  function onSettingsNavClick() {
    if (isTrackingAdmin(user)) {
      registerTrackingSettingsClick();
    }
    setMobileOpen(false);
  }

  return (
    <div className="min-h-dvh bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-brand text-black shadow-sm transition-[width,transform] duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${collapsed ? "lg:w-[4.5rem]" : "lg:w-64"} w-64`}
      >
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-black/10 ${
            collapsed ? "justify-center px-2 py-4" : "px-4 py-4"
          }`}
        >
          <BrandLogo
            size="sm"
            className={collapsed ? "lg:!h-9 lg:!w-9" : ""}
          />
          <h1
            className={`min-w-0 text-base font-semibold tracking-tight text-black ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            Seetal web
          </h1>
          <button
            type="button"
            className="ml-auto rounded-lg p-1 text-black hover:bg-white/50 lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = navItemActive(item, pathname, navItems, "/admin");
              const Icon = item.icon;
              const waiting =
                item.href === "/admin/approvals" ? pendingApprovals : 0;
              const waitingLabel = waiting > 99 ? "99+" : String(waiting);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={
                      waiting > 0
                        ? `${item.label}, ${waiting} waiting`
                        : item.label
                    }
                    aria-label={
                      waiting > 0
                        ? `${item.label}, ${waiting} waiting`
                        : undefined
                    }
                    onClick={() => {
                      if (isSettingsNavHref(item.href)) {
                        onSettingsNavClick();
                      } else {
                        setMobileOpen(false);
                      }
                    }}
                    className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-black transition ${
                      collapsed ? "lg:justify-center lg:px-2" : ""
                    } ${
                      active ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Icon
                        className="h-4 w-4 shrink-0 text-black"
                        strokeWidth={1.75}
                      />
                      {waiting > 0 && collapsed ? (
                        <span className="absolute -top-2 -right-2.5 z-10 hidden h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white lg:inline-flex">
                          {waitingLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className={collapsed ? "lg:hidden" : undefined}>
                      {item.label}
                    </span>
                    {waiting > 0 ? (
                      <span
                        className={`ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ${
                          collapsed ? "lg:hidden" : ""
                        }`}
                      >
                        {waitingLabel}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div
          className={`shrink-0 space-y-3 border-t border-black/10 ${
            collapsed ? "px-2 py-3" : "px-3 py-4"
          }`}
        >
          {showSettings ? (
          <Link
            href="/admin/settings"
            title="Settings"
            onClick={onSettingsNavClick}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1 ${
              collapsed ? "lg:justify-center" : ""
            } ${
              pathname.startsWith("/admin/settings")
                ? "bg-white/70"
                : "hover:bg-white/40"
            }`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
              {initials || "A"}
            </span>
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-sm font-semibold text-black">
                {user?.name || "Administrator"}
              </p>
              <p className="truncate text-xs text-black/80">{user?.email}</p>
            </div>
          </Link>
          ) : (
            <div
              className={`flex items-center gap-2.5 rounded-xl px-2 py-1 ${
                collapsed ? "lg:justify-center" : ""
              }`}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
                {initials || "A"}
              </span>
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="truncate text-sm font-semibold text-black">
                  {user?.name || "Administrator"}
                </p>
                <p className="truncate text-xs text-black/80">{user?.email}</p>
              </div>
            </div>
          )}
          {canAccessEnvironment(user, "shmp") ? (
            <button
              type="button"
              onClick={() => clearSelectedEnvironment()}
              title="Switch environment"
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-black hover:bg-white/50 ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className={collapsed ? "lg:hidden" : undefined}>
                Switch STL / SHMP
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className={`flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-[13.5px] font-medium text-black hover:bg-white/90 ${
              collapsed ? "lg:justify-center lg:px-2" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className={collapsed ? "lg:hidden" : undefined}>
              Sign out
            </span>
          </button>
        </div>
        <button
          type="button"
          className="absolute top-5 -right-3 hidden h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-black shadow-sm hover:bg-[#f7f5f0] lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={`flex min-h-dvh flex-col transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[6.5rem]" : "lg:pl-[18rem]"
        }`}
      >
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <button
            type="button"
            className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-black lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          {children}
        </main>
      </div>
    </div>
  );
}

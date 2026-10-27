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
  ClipboardList,
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
  Users,
  UserCog,
  Warehouse,
  X,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "./AuthProvider";
import { canAccessEnvironment, isSuperAdmin, isTrackingAdmin } from "@/lib/auth";
import {
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
  superAdminOnly?: boolean;
  /** Tracking — lav@shrseetal.com only, after 5 Settings clicks. */
  trackingOnly?: boolean;
  /** Only lav@shrseetal.com (module permissions owner). */
  lavOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "KPI dashboard", icon: LayoutDashboard },
  {
    href: "/admin/drivers-vehicles",
    label: "Drivers & vehicles",
    icon: Truck,
    match: ["/admin/drivers-vehicles", "/admin/drivers", "/admin/vehicles"],
  },
  { href: "/admin/stores", label: "Stores", icon: Store },
  { href: "/admin/profiles/sales", label: "Sales profiles", icon: Users },
  {
    href: "/admin/profiles/warehouse",
    label: "Warehouse profiles",
    icon: UserCog,
  },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/catalog", label: "Catalog", icon: ImageIcon },
  { href: "/admin/stock-transfer", label: "Stock transfer", icon: ArrowLeftRight },
  { href: "/admin/pending-orders", label: "Pending orders", icon: ClipboardList },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/admin/leave", label: "Leave", icon: CalendarDays },
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
    superAdminOnly: true,
  },
  {
    href: "/admin/attendance-reports",
    label: "Attendance reports",
    icon: FileBarChart,
  },
  {
    href: "/admin/attendance-override",
    label: "Attendance override",
    icon: CalendarX,
    superAdminOnly: true,
  },
  { href: "/admin/leave-settings", label: "Leave settings", icon: CalendarClock },
  { href: "/admin/hr", label: "HR", icon: UserSquare },
  {
    href: "/admin/driver-deliveries",
    label: "Driver deliveries",
    icon: Truck,
  },
  { href: "/admin/sales-lost", label: "Sales lost", icon: PackageX },
  {
    href: "/admin/permissions",
    label: "Permissions",
    icon: KeyRound,
    lavOnly: true,
  },
  { href: "/admin/targets", label: "Sales targets", icon: Target },
  { href: "/admin/grv", label: "GRV management", icon: RotateCcw },
  { href: "/admin/categories", label: "Categories", icon: Folders },
  { href: "/admin/payments", label: "Payments", icon: Banknote },
  { href: "/admin/warehouse", label: "Warehouse", icon: Warehouse },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const COLLAPSE_KEY = "stl_sidebar_collapsed";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout, clearSelectedEnvironment } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);
  const [trackingUnlocked, setTrackingUnlocked] = useState(false);

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
    if (item.trackingOnly) return canSeeTracking;
    if (item.superAdminOnly) return isSuperAdmin(user);
    if (item.lavOnly) return isLav;
    return true;
  });

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
              const prefixes = item.match ?? [item.href];
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : prefixes.some(
                      (prefix) =>
                        pathname === prefix ||
                        pathname.startsWith(`${prefix}/`),
                    );
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={item.label}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-black transition ${
                      collapsed ? "lg:justify-center lg:px-2" : ""
                    } ${
                      active ? "bg-white shadow-sm" : "hover:bg-white/50"
                    }`}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0 text-black"
                      strokeWidth={1.75}
                    />
                    <span className={collapsed ? "lg:hidden" : undefined}>
                      {item.label}
                    </span>
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

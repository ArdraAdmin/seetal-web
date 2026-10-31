"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Boxes,
  CalendarDays,
  ClipboardList,
  Factory,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Store,
  Truck,
  UserSquare,
  UserPlus,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "./AuthProvider";
import { isSupervisor } from "@/lib/auth";
import { shmpModuleVisible } from "@/lib/custom-users";
import { canSupervisorAccessShmpPath } from "@/lib/supervisor-shmp-access";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  match?: string[];
  moduleId?: string;
  fullAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/shmp", label: "Dashboard", icon: LayoutDashboard, moduleId: "dashboard" },
  { href: "/shmp/hr", label: "HR", icon: UserSquare, moduleId: "hr" },
  { href: "/shmp/attendance", label: "Attendance", icon: CalendarDays, moduleId: "attendance" },
  { href: "/shmp/stores", label: "Stores", icon: Store, moduleId: "stores" },
  { href: "/shmp/inventory", label: "Inventory", icon: Package, moduleId: "inventory" },
  { href: "/shmp/catalog", label: "Catalog", icon: ImageIcon, moduleId: "catalog" },
  { href: "/shmp/production", label: "Production", icon: Factory, moduleId: "production" },
  { href: "/shmp/rm", label: "RM Store", icon: Boxes, moduleId: "rm" },
  { href: "/shmp/orders", label: "Orders", icon: ClipboardList, moduleId: "orders" },
  { href: "/shmp/delivery", label: "Delivery", icon: PackageCheck, moduleId: "delivery" },
  {
    href: "/shmp/drivers-vehicles",
    label: "Drivers & vehicles",
    icon: Truck,
    moduleId: "drivers-vehicles",
    match: ["/shmp/drivers-vehicles", "/shmp/drivers", "/shmp/vehicles"],
  },
  { href: "/shmp/costing", label: "Product Costing", icon: Package, moduleId: "costing" },
  { href: "/shmp/reports", label: "Reports", icon: CalendarDays, moduleId: "reports" },
  {
    href: "/shmp/users",
    label: "User management",
    icon: UserPlus,
    match: ["/shmp/users"],
    fullAdminOnly: true,
  },
  { href: "/shmp/settings", label: "Settings", icon: Settings, moduleId: "settings" },
];

const COLLAPSE_KEY = "shmp_sidebar_collapsed";

export function ShmpShell({ children }: { children: React.ReactNode }) {
  const { user, logout, clearSelectedEnvironment } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setCollapseReady(true);
  }, []);

  useEffect(() => {
    if (!collapseReady) return;
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed, collapseReady]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = (user?.name || "S")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const supervisor = isSupervisor(user);
  const navItems = NAV.filter((item) => {
    if (item.fullAdminOnly) {
      return user?.role === "Admin" && !user.customAccess;
    }
    if (supervisor) return canSupervisorAccessShmpPath(item.href);
    if (user?.customAccess) {
      return Boolean(
        item.moduleId && shmpModuleVisible(user.customAccess, item.moduleId),
      );
    }
    return true;
  });
  const canSwitchEnvironment = (user?.environments?.length ?? 0) > 1;

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
          <BrandLogo size="sm" className={collapsed ? "lg:!h-9 lg:!w-9" : ""} />
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <h1 className="text-base font-semibold tracking-tight text-black">
              SHMP
            </h1>
            <p className="text-[11px] text-black/70">Manufacturing</p>
          </div>
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
                item.href === "/shmp"
                  ? pathname === "/shmp"
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
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-black transition ${
                      collapsed ? "lg:justify-center lg:px-2" : ""
                    } ${active ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
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
          className={`shrink-0 space-y-2 border-t border-black/10 ${
            collapsed ? "px-2 py-3" : "px-3 py-4"
          }`}
        >
          {canSwitchEnvironment ? (
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
          <div
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1 ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black">
              {initials || "S"}
            </span>
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-sm font-semibold text-black">
                {user?.name || "User"}
              </p>
              <p className="truncate text-xs text-black/80">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className={`flex w-full items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-[13.5px] font-medium text-black hover:bg-white/90 ${
              collapsed ? "lg:justify-center lg:px-2" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className={collapsed ? "lg:hidden" : undefined}>Sign out</span>
          </button>
        </div>
        <button
          type="button"
          className="absolute top-5 -right-3 hidden h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-black shadow-sm hover:bg-[#f7f5f0] lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
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

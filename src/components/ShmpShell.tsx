"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  Banknote,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Fingerprint,
  ShieldCheck,
  Factory,
  Folders,
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
import { isLabelChecker, isSupervisor } from "@/lib/auth";
import { shmpNavVisible } from "@/lib/shmp-permissions";
import { canLabelCheckerAccessShmpPath } from "@/lib/label-checker-access";
import { navItemActive } from "@/lib/nav-active";
import { canSupervisorAccessShmpPath } from "@/lib/supervisor-shmp-access";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  match?: string[];
  moduleId?: string;
  fieldId?: string;
  fullAdminOnly?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: NavIcon;
  href: string;
  match?: string[];
  moduleId?: string;
  children: NavItem[];
  /** False when the user may see children but not the HR home page. */
  parentLinkVisible?: boolean;
};

type NavEntry =
  | { kind: "link"; item: NavItem }
  | { kind: "group"; group: NavGroup };

const HR_CHILDREN: NavItem[] = [
  { href: "/shmp/attendance", label: "Attendance", icon: CalendarDays, moduleId: "attendance" },
  {
    href: "/shmp/hr/payroll",
    label: "Payroll",
    icon: Banknote,
    moduleId: "payroll",
  },
  {
    href: "/shmp/biometric",
    label: "Biometric devices",
    icon: Fingerprint,
    moduleId: "attendance",
  },
];

const NAV: NavEntry[] = [
  { kind: "link", item: { href: "/shmp", label: "Dashboard", icon: LayoutDashboard, moduleId: "dashboard" } },
  {
    kind: "link",
    item: {
      href: "/shmp/drivers-vehicles",
      label: "Drivers & vehicles",
      icon: Truck,
      moduleId: "drivers-vehicles",
      match: ["/shmp/drivers-vehicles", "/shmp/drivers", "/shmp/vehicles"],
    },
  },
  {
    kind: "link",
    item: {
      href: "/shmp/company",
      label: "My company",
      icon: Building2,
      moduleId: "my-company",
    },
  },
  { kind: "link", item: { href: "/shmp/stores", label: "Stores", icon: Store, moduleId: "stores" } },
  { kind: "link", item: { href: "/shmp/inventory", label: "Inventory", icon: Package, moduleId: "inventory" } },
  { kind: "link", item: { href: "/shmp/catalog", label: "Catalog", icon: ImageIcon, moduleId: "catalog" } },
  { kind: "link", item: { href: "/shmp/production", label: "Production", icon: Factory, moduleId: "production" } },
  { kind: "link", item: { href: "/shmp/rm", label: "RM Store", icon: Boxes, moduleId: "rm" } },
  {
    kind: "link",
    item: {
      href: "/shmp/approvals",
      label: "Approvals",
      icon: ShieldCheck,
      moduleId: "approvals",
    },
  },
  {
    kind: "group",
    group: {
      id: "hr",
      label: "HR",
      icon: UserSquare,
      href: "/shmp/hr",
      moduleId: "hr",
      children: HR_CHILDREN,
    },
  },
  { kind: "link", item: { href: "/shmp/orders", label: "Orders", icon: ClipboardList, moduleId: "orders" } },
  { kind: "link", item: { href: "/shmp/delivery", label: "Delivery", icon: PackageCheck, moduleId: "delivery" } },
  { kind: "link", item: { href: "/shmp/costing", label: "Product Costing", icon: Package, moduleId: "costing" } },
  { kind: "link", item: { href: "/shmp/reports", label: "Reports", icon: CalendarDays, moduleId: "reports" } },
  {
    kind: "link",
    item: {
      href: "/shmp/users",
      label: "User management",
      icon: UserPlus,
      match: ["/shmp/users"],
      fullAdminOnly: true,
    },
  },
  { kind: "link", item: { href: "/shmp/categories", label: "Categories", icon: Folders, moduleId: "categories" } },
  { kind: "link", item: { href: "/shmp/settings", label: "Settings", icon: Settings, moduleId: "settings" } },
];

function navTargetsForActive(entries: NavEntry[]): NavItem[] {
  const items: NavItem[] = [];
  for (const entry of entries) {
    if (entry.kind === "link") {
      items.push(entry.item);
      continue;
    }
    if (entry.group.parentLinkVisible !== false) {
      items.push({
        href: entry.group.href,
        label: entry.group.label,
        icon: entry.group.icon,
        match: entry.group.match,
        moduleId: entry.group.moduleId,
      });
    }
    items.push(...entry.group.children);
  }
  return items;
}

function pathInNavGroup(pathname: string, group: NavGroup) {
  const prefixes = [
    group.href,
    ...(group.match ?? []),
    ...group.children.flatMap((child) => child.match ?? [child.href]),
  ];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const COLLAPSE_KEY = "shmp_sidebar_collapsed";

export function ShmpShell({ children }: { children: React.ReactNode }) {
  const { user, logout, clearSelectedEnvironment } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapseReady, setCollapseReady] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [hrDismissedPath, setHrDismissedPath] = useState<string | null>(null);

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
  const labelChecker = isLabelChecker(user);

  function itemVisible(item: NavItem) {
    if (item.fullAdminOnly) {
      return user?.role === "Admin" && !user.customAccess;
    }
    if (supervisor) return canSupervisorAccessShmpPath(item.href);
    if (labelChecker) return canLabelCheckerAccessShmpPath(item.href);
    if (user?.customAccess) {
      if (!item.moduleId || !shmpNavVisible(user.customAccess, item.moduleId)) {
        return false;
      }
      return true;
    }
    return true;
  }

  const navEntries = NAV.flatMap((entry): NavEntry[] => {
    if (entry.kind === "link") {
      return itemVisible(entry.item) ? [entry] : [];
    }
    const children = entry.group.children.filter(itemVisible);
    const parentVisible = itemVisible({
      href: entry.group.href,
      label: entry.group.label,
      icon: entry.group.icon,
      match: entry.group.match,
      moduleId: entry.group.moduleId,
    });
    if (!parentVisible && children.length === 0) return [];
    return [
      {
        kind: "group",
        group: {
          ...entry.group,
          children,
          parentLinkVisible: parentVisible,
        },
      },
    ];
  });
  const navItems = navTargetsForActive(navEntries);
  const hrGroup = navEntries.find(
    (entry): entry is Extract<NavEntry, { kind: "group" }> =>
      entry.kind === "group" && entry.group.id === "hr",
  )?.group;
  const inHrSection = hrGroup ? pathInNavGroup(pathname, hrGroup) : false;
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
            {navEntries.map((entry) => {
              if (entry.kind === "link") {
                const item = entry.item;
                const active = navItemActive(item, pathname, navItems, "/shmp");
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
              }

              const group = entry.group;
              const GroupIcon = group.icon;
              const parentLinkVisible = group.parentLinkVisible !== false;
              const groupActive = parentLinkVisible
                ? navItemActive(
                    {
                      href: group.href,
                      match: group.match,
                    },
                    pathname,
                    navItems,
                    "/shmp",
                  )
                : false;
              const hrDismissed = hrDismissedPath === pathname;
              const showChildren =
                !hrDismissed &&
                (hrOpen || inHrSection) &&
                group.children.length > 0 &&
                (!collapsed || mobileOpen);
              const headerClass = `flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 ${
                collapsed ? "lg:justify-center lg:px-2" : ""
              }`;

              function toggleHrGroup() {
                if (showChildren) {
                  setHrOpen(false);
                  setHrDismissedPath(pathname);
                  return;
                }
                setHrDismissedPath(null);
                setHrOpen(true);
              }

              return (
                <li key={group.id}>
                  <div
                    className={`flex items-center rounded-xl text-[13.5px] font-medium text-black transition ${
                      groupActive || inHrSection
                        ? "bg-white/70 shadow-sm"
                        : "hover:bg-white/50"
                    } ${collapsed ? "lg:justify-center" : ""}`}
                  >
                    {parentLinkVisible ? (
                      <Link
                        href={group.href}
                        title={group.label}
                        onClick={() => {
                          setHrDismissedPath(null);
                          setHrOpen(true);
                          setMobileOpen(false);
                        }}
                        className={headerClass}
                      >
                        <GroupIcon
                          className="h-4 w-4 shrink-0 text-black"
                          strokeWidth={1.75}
                        />
                        <span className={collapsed ? "lg:hidden" : undefined}>
                          {group.label}
                        </span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        title={group.label}
                        onClick={toggleHrGroup}
                        className={headerClass}
                      >
                        <GroupIcon
                          className="h-4 w-4 shrink-0 text-black"
                          strokeWidth={1.75}
                        />
                        <span className={collapsed ? "lg:hidden" : undefined}>
                          {group.label}
                        </span>
                      </button>
                    )}
                    {group.children.length > 0 ? (
                      <button
                        type="button"
                        aria-label={
                          showChildren
                            ? `Collapse ${group.label}`
                            : `Expand ${group.label}`
                        }
                        aria-expanded={showChildren}
                        className={`mr-1 rounded-lg p-1.5 hover:bg-white/60 ${
                          collapsed ? "lg:hidden" : ""
                        }`}
                        onClick={toggleHrGroup}
                      >
                        <ChevronDown
                          className={`h-4 w-4 text-black transition-transform ${
                            showChildren ? "rotate-0" : "-rotate-90"
                          }`}
                          strokeWidth={1.75}
                        />
                      </button>
                    ) : null}
                  </div>
                  {showChildren ? (
                    <ul className="mt-1 ml-4 space-y-1 border-l border-black/15 pl-2">
                      {group.children.map((child) => {
                        const childActive = navItemActive(
                          child,
                          pathname,
                          navItems,
                          "/shmp",
                        );
                        const ChildIcon = child.icon;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              title={child.label}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-black transition ${
                                childActive
                                  ? "bg-white shadow-sm"
                                  : "hover:bg-white/50"
                              }`}
                            >
                              <ChildIcon
                                className="h-3.5 w-3.5 shrink-0 text-black"
                                strokeWidth={1.75}
                              />
                              <span>{child.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
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
                Switch Seetal / SHMP
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

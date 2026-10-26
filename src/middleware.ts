import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, parseAuthCookie } from "@/lib/session";
import {
  canSupervisorAccessShmpPath,
  homePathForRole,
  supervisorShmpHome,
} from "@/lib/roles";
import {
  homePathForEnvironment,
  normalizeEnvironments,
} from "@/lib/environment";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = parseAuthCookie(raw);
  const role = session?.role;
  const authed = Boolean(session?.token);
  const environments = normalizeEnvironments(
    session?.environments,
    role,
    session?.isSuperAdmin === true,
  );
  const environment = String(session?.environment || "").toLowerCase();

  if (pathname.startsWith("/admin")) {
    if (!authed || role !== "Admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (environments.includes("stl") === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/select-environment";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/sales")) {
    if (!authed || role !== "Sales") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/warehouse")) {
    if (!authed || role !== "Warehouse") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/shmp")) {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const allowedRoles = ["Admin", "Supervisor"];
    if (!allowedRoles.includes(String(role))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (!environments.includes("shmp")) {
      const url = request.nextUrl.clone();
      url.pathname = "/select-environment";
      return NextResponse.redirect(url);
    }
    if (
      role === "Supervisor" &&
      !canSupervisorAccessShmpPath(pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = supervisorShmpHome();
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/select-environment") {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/login" && authed) {
    const url = request.nextUrl.clone();
    if (environments.length > 1 && !environment) {
      url.pathname = "/select-environment";
    } else if (environment === "shmp") {
      url.pathname = homePathForEnvironment("shmp", role);
    } else {
      url.pathname = homePathForRole(role);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/sales",
    "/sales/:path*",
    "/warehouse",
    "/warehouse/:path*",
    "/shmp",
    "/shmp/:path*",
    "/select-environment",
    "/login",
  ],
};

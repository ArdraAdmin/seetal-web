import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, parseAuthCookie } from "@/lib/session";
import { homePathForRole } from "@/lib/roles";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = parseAuthCookie(raw);
  const role = session?.role;
  const authed = Boolean(session?.token);

  if (pathname.startsWith("/admin")) {
    if (!authed || role !== "Admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
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

  if (pathname === "/login" && authed) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(role);
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
    "/login",
  ],
};

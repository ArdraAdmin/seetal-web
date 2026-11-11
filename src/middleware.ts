import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_COOKIE,
  parseAuthCookie,
  remoteSessionDecision,
  SESSION_CHECK_COOKIE,
  SESSION_CHECK_MAX_AGE,
} from "@/lib/session";
import {
  canCustomUserAccessPath,
  customHomePath,
  firstAllowedPath,
  readCustomAccess,
  type AppSide,
} from "@/lib/custom-users";
import { canLabelCheckerAccessShmpPath } from "@/lib/label-checker-access";
import {
  canSupervisorAccessShmpPath,
  homePathForRole,
  supervisorShmpHome,
} from "@/lib/roles";
import {
  homePathForEnvironment,
  LABEL_CHECKER_SHMP_HOME,
  normalizeEnvironments,
} from "@/lib/environment";

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

async function remoteSessionStatus(token: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_ORIGIN}/user/me`, {
      headers: { "auth-token": token, Authorization: token },
      cache: "no-store",
      signal: controller.signal,
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function endSavedSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response =
    pathname === "/login"
      ? NextResponse.next()
      : NextResponse.redirect(loginUrl(request));
  response.cookies.set(AUTH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  response.cookies.set(SESSION_CHECK_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

function loginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  const session = parseAuthCookie(raw);
  const role = session?.role;
  const authed = Boolean(session?.token);
  let markChecked = false;

  if (authed && session?.token && request.cookies.get(SESSION_CHECK_COOKIE)?.value !== "1") {
    const decision = remoteSessionDecision(await remoteSessionStatus(session.token));
    if (decision === "reject") return endSavedSession(request);
    if (decision === "allow") markChecked = true;
  }

  const finish = (response: NextResponse) => {
    if (markChecked) {
      response.cookies.set(SESSION_CHECK_COOKIE, "1", {
        path: "/",
        maxAge: SESSION_CHECK_MAX_AGE,
        sameSite: "lax",
        httpOnly: true,
      });
    }
    return response;
  };
  const environments = normalizeEnvironments(
    session?.environments,
    role,
    session?.isSuperAdmin === true,
  );
  const environment = String(session?.environment || "").toLowerCase();
  const customAccess =
    session && Object.prototype.hasOwnProperty.call(session, "customAccess")
      ? readCustomAccess(session.customAccess)
      : null;

  if (pathname.startsWith("/admin")) {
    if (!authed || role !== "Admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
    }
    if (environments.includes("stl") === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/select-environment";
      return finish(NextResponse.redirect(url));
    }
    if (customAccess) {
      const blocked = redirectCustom(request, customAccess, pathname);
      if (blocked) return finish(blocked);
    }
  }

  if (pathname.startsWith("/sales")) {
    if (!authed || role !== "Sales") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
    }
  }

  if (pathname.startsWith("/warehouse")) {
    if (!authed || role !== "Warehouse") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
    }
  }

  if (pathname.startsWith("/shmp")) {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
    }
    const allowedRoles = ["Admin", "Supervisor", "LabelChecker"];
    if (!allowedRoles.includes(String(role))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return finish(NextResponse.redirect(url));
    }
    if (!environments.includes("shmp")) {
      const url = request.nextUrl.clone();
      url.pathname = "/select-environment";
      return finish(NextResponse.redirect(url));
    }
    if (
      role === "Supervisor" &&
      !canSupervisorAccessShmpPath(pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = supervisorShmpHome();
      return finish(NextResponse.redirect(url));
    }
    if (role === "LabelChecker" && !canLabelCheckerAccessShmpPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = LABEL_CHECKER_SHMP_HOME;
      return finish(NextResponse.redirect(url));
    }
    if (customAccess) {
      const blocked = redirectCustom(request, customAccess, pathname);
      if (blocked) return finish(blocked);
    }
  }

  if (pathname === "/select-environment") {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return finish(NextResponse.redirect(url));
    }
  }

  if (pathname === "/login" && authed) {
    const url = request.nextUrl.clone();
    if (customAccess) {
      const selected: AppSide | null =
        environment === "stl" || environment === "shmp" ? environment : null;
      url.pathname = customHomePath(
        customAccess,
        environments.filter(
          (env): env is AppSide => env === "stl" || env === "shmp",
        ),
        selected,
      );
    } else if (environments.length > 1 && !environment) {
      url.pathname = "/select-environment";
    } else if (environment === "shmp") {
      url.pathname = homePathForEnvironment("shmp", role);
    } else {
      url.pathname = homePathForRole(role);
    }
    return finish(NextResponse.redirect(url));
  }

  return finish(NextResponse.next());
}

function redirectCustom(
  request: NextRequest,
  access: NonNullable<ReturnType<typeof readCustomAccess>>,
  pathname: string,
) {
  if (canCustomUserAccessPath(access, pathname)) return null;
  const preferred: AppSide = pathname.startsWith("/shmp") ? "shmp" : "stl";
  const dest =
    firstAllowedPath(access, preferred) ||
    firstAllowedPath(access, preferred === "stl" ? "shmp" : "stl") ||
    "/no-access";
  if (dest === pathname) return null;
  const url = request.nextUrl.clone();
  url.pathname = dest;
  url.search = "";
  return NextResponse.redirect(url);
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

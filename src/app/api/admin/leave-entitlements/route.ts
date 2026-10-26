import {
  getPortalLeaveEntitlements,
  setPortalLeaveEntitlements,
} from "@/lib/server/leave-entitlements";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to update leave";
  const status =
    message === "Not signed in" || message === "Not allowed" ? 401 : 400;
  return json({ error: message }, status);
}

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const ids = new URL(req.url).searchParams.get("ids") || "";
  try {
    const entitlements = await getPortalLeaveEntitlements({
      token,
      userIds: ids.split(",").map((id) => id.trim()).filter(Boolean),
    });
    return json({ entitlements });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return json({ entitlements: {} });
    }
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = (await req.json()) as {
    userIds?: string[];
    annualLeaveDays?: number;
    sickLeaveDays?: number;
  };
  try {
    const result = await setPortalLeaveEntitlements({
      token,
      userIds: Array.isArray(body.userIds) ? body.userIds : [],
      annualLeaveDays: Number(body.annualLeaveDays),
      sickLeaveDays: Number(body.sickLeaveDays),
    });
    return json(result);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return json(
        { error: "Database is not configured" },
        503,
      );
    }
    return errorResponse(error);
  }
}

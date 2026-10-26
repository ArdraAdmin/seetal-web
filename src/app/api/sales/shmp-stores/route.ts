import { isDatabaseNotConfigured } from "@/lib/server/mongo";
import { assignedShmpStoresForSalesUser } from "@/lib/server/shmp-sales-stores";

export const runtime = "nodejs";

function errorStatus(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to load SHMP stores";
  const status =
    message === "Not signed in" || message === "Not allowed"
      ? 401
      : isDatabaseNotConfigured(error)
        ? 503
        : 400;
  return { message, status };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = String(
    url.searchParams.get("userId") || url.searchParams.get("salesId") || "",
  ).trim();
  const tag = String(url.searchParams.get("tag") || "").trim();
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!userId) {
    return Response.json({ error: "Sales person is required" }, { status: 400 });
  }
  try {
    const stores = await assignedShmpStoresForSalesUser(token, userId, tag);
    return Response.json(stores);
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    const body = (await req.json()) as {
      userId?: unknown;
      salesId?: unknown;
      tag?: unknown;
      page?: unknown;
    };
    const userId = String(body.userId || body.salesId || "").trim();
    if (!userId) {
      return Response.json({ error: "Sales person is required" }, { status: 400 });
    }
    const page = Number(body.page);
    if (!Number.isFinite(page) || page < 1) {
      return Response.json({ error: "Invalid Page Number" }, { status: 400 });
    }
    const tag = String(body.tag || "").trim();
    const stores = await assignedShmpStoresForSalesUser(token, userId, tag);
    return Response.json({ myStoreArr: stores, otherStore: [] });
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

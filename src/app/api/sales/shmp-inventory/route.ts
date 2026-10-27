import { isDatabaseNotConfigured } from "@/lib/server/mongo";
import { shmpStoreInventoryForSalesUser } from "@/lib/server/shmp-sales-inventory";

export const runtime = "nodejs";

function errorStatus(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to load SHMP inventory";
  const status =
    message === "Not signed in" || message === "Not allowed"
      ? 401
      : message === "Store not found"
        ? 404
        : isDatabaseNotConfigured(error)
          ? 503
          : 400;
  return { message, status };
}

function readToken(req: Request) {
  return req.headers.get("authorization") || req.headers.get("Authorization");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = String(
    url.searchParams.get("userId") || url.searchParams.get("salesId") || "",
  ).trim();
  const storeId = String(url.searchParams.get("storeId") || "").trim();
  const companyId = String(url.searchParams.get("companyId") || "").trim();
  if (!userId) {
    return Response.json({ error: "Sales person is required" }, { status: 400 });
  }
  if (!storeId) {
    return Response.json({ error: "Store is required" }, { status: 400 });
  }
  try {
    const products = await shmpStoreInventoryForSalesUser(
      readToken(req),
      userId,
      storeId,
      companyId,
    );
    return Response.json({ products });
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: unknown;
      salesId?: unknown;
      storeId?: unknown;
      companyId?: unknown;
    };
    const userId = String(body.userId || body.salesId || "").trim();
    const storeId = String(body.storeId || "").trim();
    const companyId = String(body.companyId || "").trim();
    if (!userId) {
      return Response.json({ error: "Sales person is required" }, { status: 400 });
    }
    if (!storeId) {
      return Response.json({ error: "Store is required" }, { status: 400 });
    }
    const products = await shmpStoreInventoryForSalesUser(
      readToken(req),
      userId,
      storeId,
      companyId,
    );
    return Response.json({ products });
  } catch (error) {
    const { message, status } = errorStatus(error);
    return Response.json({ error: message }, { status });
  }
}

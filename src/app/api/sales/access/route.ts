import { isDatabaseNotConfigured } from "@/lib/server/mongo";
import { salesCompanyAccessForUser } from "@/lib/server/sales-access";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = String(url.searchParams.get("userId") || "").trim();
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!userId) {
    return Response.json({ error: "Sales person is required" }, { status: 400 });
  }
  try {
    const access = await salesCompanyAccessForUser(token, userId);
    return Response.json(access);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load company access";
    const status =
      message === "Not signed in" || message === "Not allowed"
        ? 401
        : isDatabaseNotConfigured(error)
          ? 503
          : 400;
    return Response.json({ error: message }, { status });
  }
}

import { stampLoadCheckedAt } from "@/lib/server/warehouse-loaded";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    const body = (await req.json()) as { orderId?: string };
    const result = await stampLoadCheckedAt(token, String(body.orderId || ""));
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update order";
    const status = isDatabaseNotConfigured(error)
      ? 503
      : message === "Not signed in" || message === "Not allowed"
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}

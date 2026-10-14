import { after } from "next/server";
import {
  deliverExpiredLoadedOrders,
  listLoadedWarehouseOrders,
} from "@/lib/server/warehouse-loaded";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    const orders = await listLoadedWarehouseOrders(token);
    after(() =>
      deliverExpiredLoadedOrders(token).catch(() => undefined),
    );
    return Response.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load orders";
    const status = isDatabaseNotConfigured(error)
      ? 503
      : message === "Not signed in" || message === "Not allowed"
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}

import {
  isStoreDbUnconfigured,
  setStoreSalesPeople,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = await req.json();
  try {
    await setStoreSalesPeople(token, body);
    return new Response("Store access updated", { status: 200 });
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return new Response("Database is not configured", { status: 400 });
    }
    return storeError(error);
  }
}

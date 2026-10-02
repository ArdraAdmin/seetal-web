import {
  isStoreDbUnconfigured,
  proxyUpdateStoreRecord,
  storeError,
  updateStoreRecord,
} from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = await req.json();
  try {
    await updateStoreRecord(token, body);
    return new Response("Store updated", { status: 200 });
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return proxyUpdateStoreRecord(req, body);
    }
    return storeError(error);
  }
}

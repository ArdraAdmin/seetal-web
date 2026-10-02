import {
  isStoreDbUnconfigured,
  removeDuplicateStores,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    return Response.json(await removeDuplicateStores(token));
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return new Response(
        "Removing duplicate stores needs a database connection on this server",
        { status: 400 },
      );
    }
    return storeError(error);
  }
}

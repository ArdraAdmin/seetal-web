import { removeDuplicateStores, storeError } from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    return Response.json(await removeDuplicateStores(token));
  } catch (error) {
    return storeError(error);
  }
}

import { storeError, updateStoreRecord } from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    await updateStoreRecord(token, await req.json());
    return new Response("Store updated", { status: 200 });
  } catch (error) {
    return storeError(error);
  }
}

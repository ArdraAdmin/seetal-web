import { deleteStoreRecord, storeError } from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = (await req.json()) as { storeId?: string };
  try {
    return Response.json(await deleteStoreRecord(token, body.storeId));
  } catch (error) {
    return storeError(error);
  }
}

import { listAssignedStoresForSalesUser, storeError } from "@/lib/server/stores";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const userId = new URL(req.url).searchParams.get("userId") || "";
  try {
    return Response.json(await listAssignedStoresForSalesUser(token, userId));
  } catch (error) {
    return storeError(error);
  }
}

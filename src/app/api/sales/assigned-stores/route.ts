import { listAssignedStoresForSalesUser, storeError } from "@/lib/server/stores";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || "";
  const includeSarvahHomes =
    url.searchParams.get("includeSarvahHomes") === "1" ||
    url.searchParams.get("includeSarvahHomes") === "true";
  try {
    return Response.json(
      await listAssignedStoresForSalesUser(token, userId, {
        includeSarvahHomes,
      }),
    );
  } catch (error) {
    return storeError(error);
  }
}

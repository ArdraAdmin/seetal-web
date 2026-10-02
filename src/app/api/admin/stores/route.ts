import {
  isStoreDbUnconfigured,
  listAdminStores,
  proxyListAdminStores,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    return Response.json(await listAdminStores(token));
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return proxyListAdminStores(req);
    }
    return storeError(error);
  }
}

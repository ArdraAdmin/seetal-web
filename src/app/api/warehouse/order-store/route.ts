import {
  changeOrderStore,
  isStoreDbUnconfigured,
  proxyChangeOrderStore,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = (await req.json()) as {
    orderId?: string;
    storeId?: string;
    userId?: string;
  };
  try {
    return Response.json(
      await changeOrderStore(token, body.orderId, body.storeId),
    );
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return proxyChangeOrderStore(req, body);
    }
    return storeError(error);
  }
}

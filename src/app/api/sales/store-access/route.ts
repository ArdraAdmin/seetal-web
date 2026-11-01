import { salesStoreAccess } from "@/lib/server/stores";

export const runtime = "nodejs";

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to check store";
  const status =
    message === "Not signed in" || message === "Not allowed"
      ? 401
      : message === "No access to this store"
        ? 403
        : message === "Store not found"
          ? 404
          : 400;
  return new Response(message, { status });
}

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const url = new URL(req.url);
  try {
    return Response.json(
      await salesStoreAccess(
        token,
        url.searchParams.get("userId") || "",
        url.searchParams.get("storeId") || "",
      ),
    );
  } catch (error) {
    return accessError(error);
  }
}

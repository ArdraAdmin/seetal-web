import {
  isStoreDbUnconfigured,
  proxySetStoreOrderBlocked,
  setStoreOrderBlocked,
  storeError,
} from "@/lib/server/stores";

export const runtime = "nodejs";

function isMissingRoute(status: number, body: string) {
  if (status !== 404) return false;
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    const error = parsed?.error;
    if (error && typeof error === "object") {
      return (error as { message?: unknown }).message === "Not found";
    }
    return error === "Not found";
  } catch {
    return body.trim() === "Not found";
  }
}

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const body = (await req.json()) as Record<string, unknown>;
  try {
    const proxied = await proxySetStoreOrderBlocked(req, body);
    if (proxied.ok) return proxied;
    const textBody = await proxied.clone().text();
    if (!isMissingRoute(proxied.status, textBody)) return proxied;
  } catch {
    // The store API is unreachable. Save through the database instead.
  }
  try {
    return Response.json(await setStoreOrderBlocked(token, body));
  } catch (error) {
    if (isStoreDbUnconfigured(error)) {
      return new Response("Unable to update store", { status: 503 });
    }
    return storeError(error);
  }
}

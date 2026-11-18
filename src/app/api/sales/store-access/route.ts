/**
 * Thin proxy to STLAPI. Prefer calling `/sales/storeAccess` via the API client
 * (`fetchSalesStoreAccess`) from the browser; this route exists for any leftover
 * same-origin callers and must not open Mongo from Next.js.
 */
export const runtime = "nodejs";

const REMOTE_API = (
  process.env.NEXT_PUBLIC_API_BASE ?? "https://stl-api-testing.herokuapp.com"
).replace(/\/$/, "");

export async function GET(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const url = new URL(req.url);
  const storeId = String(url.searchParams.get("storeId") || "").trim();
  const userId = String(url.searchParams.get("userId") || "").trim();
  if (!storeId || !userId) {
    return new Response("Store and sales person are required", { status: 400 });
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", token);
    headers.set("auth-token", token);
  }

  try {
    const res = await fetch(`${REMOTE_API}/sales/storeAccess`, {
      method: "POST",
      headers,
      body: JSON.stringify({ storeId, userId }),
      cache: "no-store",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to check store";
    return new Response(message, { status: 502 });
  }
}

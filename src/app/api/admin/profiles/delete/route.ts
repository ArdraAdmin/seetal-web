import {
  deleteSalesOrWarehouseProfile,
  isDatabaseNotConfigured,
  proxyDeleteUser,
} from "@/lib/server/profiles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { userId?: string };
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");

  try {
    await deleteSalesOrWarehouseProfile({
      token,
      userId: body.userId,
    });
    return new Response("Successfully removed", { status: 200 });
  } catch (error) {
    if (isDatabaseNotConfigured(error) && body.userId) {
      return proxyDeleteUser(req, body.userId);
    }
    const message =
      error instanceof Error ? error.message : "Unable to delete profile";
    const status =
      message === "Not signed in" || message === "Not allowed" ? 401 : 400;
    return new Response(message, { status });
  }
}

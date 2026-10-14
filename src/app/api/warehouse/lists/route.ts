import { buildWarehouseList } from "@/lib/server/warehouse-lists";
import { isDatabaseNotConfigured } from "@/lib/server/mongo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token =
    req.headers.get("authorization") || req.headers.get("Authorization");
  try {
    const body = (await req.json()) as { tag?: string };
    const file = await buildWarehouseList(token, String(body.tag || ""));
    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build list";
    const status = isDatabaseNotConfigured(error)
      ? 503
      : message === "Not signed in" || message === "Not allowed"
        ? 401
        : 400;
    return Response.json({ error: message }, { status });
  }
}

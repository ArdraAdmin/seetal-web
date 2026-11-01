import { getLinkedVehicleFile, isVehicleStoreUnconfigured, requireVehicleUser } from "@/lib/server/vehicles";
import { readVehicleFile } from "@/lib/server/vehicle-files";
import { contentDisposition } from "@/lib/server/vehicle-uploads";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const { id } = await context.params;
    const linked = await getLinkedVehicleFile(id);
    if (!linked) return new Response("File not found", { status: 404 });
    const bytes = await readVehicleFile(linked.key);
    if (!bytes) return new Response("File not found", { status: 404 });
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": linked.contentType || "application/octet-stream",
        "Content-Disposition": contentDisposition(linked.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return new Response("Database is not configured", { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unable to download file";
    const status = message === "Not signed in" ? 401 : 400;
    return new Response(message, { status });
  }
}

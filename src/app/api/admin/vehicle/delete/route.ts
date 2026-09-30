import {
  deleteVehicleRecord,
  isVehicleStoreUnconfigured,
  proxyVehicleMutation,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { vehicleId?: string };
  try {
    await deleteVehicleRecord(body.vehicleId);
    return new Response("Done", { status: 200 });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return proxyVehicleMutation("/admin/vehicle/delete", req, body);
    }
    const message =
      error instanceof Error ? error.message : "Unable to delete vehicle";
    return new Response(message, { status: 400 });
  }
}

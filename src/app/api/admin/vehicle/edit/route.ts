import {
  isVehicleStoreUnconfigured,
  parseVehicleExtras,
  proxyVehicleMutation,
  updateVehicleExtras,
  updateVehicleRecord,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  const vehicleId = body.vehicleId;
  const vehicleNumber = body.vehicleNumber;
  try {
    await updateVehicleRecord(vehicleId, vehicleNumber);
    await updateVehicleExtras(vehicleId, parseVehicleExtras(body));
    return new Response("Done", { status: 200 });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return proxyVehicleMutation("/admin/vehicle/edit", req, {
        vehicleId,
        vehicleNumber,
      });
    }
    const message =
      error instanceof Error ? error.message : "Unable to update vehicle";
    return new Response(message, { status: 400 });
  }
}

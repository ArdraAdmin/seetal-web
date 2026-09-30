import {
  isVehicleStoreUnconfigured,
  proxyVehicleMutation,
  updateVehicleRecord,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    vehicleId?: string;
    vehicleNumber?: number;
  };
  try {
    await updateVehicleRecord(body.vehicleId, body.vehicleNumber);
    return new Response("Done", { status: 200 });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return proxyVehicleMutation("/admin/vehicle/edit", req, body);
    }
    const message =
      error instanceof Error ? error.message : "Unable to update vehicle";
    return new Response(message, { status: 400 });
  }
}

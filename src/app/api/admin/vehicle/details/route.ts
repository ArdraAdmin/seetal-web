import {
  getVehicleExtrasMap,
  getVehicleMaintenanceList,
  isVehicleStoreUnconfigured,
  requireVehicleUser,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unable to load vehicle details";
  const status = message === "Not signed in" ? 401 : 400;
  return json({ error: message }, status);
}

export async function GET(req: Request) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const url = new URL(req.url);
    const vehicleId = (url.searchParams.get("vehicleId") || "").trim();
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (vehicleId) ids.unshift(vehicleId);
    const extras = await getVehicleExtrasMap(ids);
    if (!vehicleId) return json({ extras });
    const maintenance = await getVehicleMaintenanceList(vehicleId);
    return json({
      extras: extras[vehicleId] || {},
      maintenance,
    });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      const vehicleId = new URL(req.url).searchParams.get("vehicleId");
      return json(
        vehicleId
          ? { extras: {}, maintenance: [] }
          : { extras: {} },
      );
    }
    return errorResponse(error);
  }
}

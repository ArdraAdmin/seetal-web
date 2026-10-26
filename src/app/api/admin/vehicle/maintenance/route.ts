import {
  addVehicleMaintenanceRecord,
  getVehicleMaintenanceList,
  isVehicleStoreUnconfigured,
  requireVehicleUser,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "Not signed in"
      ? 401
      : message === "Database is not configured"
        ? 503
        : 400;
  return json({ error: message }, status);
}

export async function GET(req: Request) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const vehicleId = new URL(req.url).searchParams.get("vehicleId");
    const maintenance = await getVehicleMaintenanceList(vehicleId);
    return json({ maintenance });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return json({ maintenance: [] });
    }
    return errorResponse(error, "Unable to load maintenance");
  }
}

export async function POST(req: Request) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const body = (await req.json()) as Record<string, unknown>;
    const item = await addVehicleMaintenanceRecord({
      vehicleId: body.vehicleId,
      title: body.title,
      amount: body.amount,
      description: body.description,
      date: body.date,
    });
    return json(item, 201);
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return json({ error: "Database is not configured" }, 503);
    }
    return errorResponse(error, "Unable to add maintenance");
  }
}

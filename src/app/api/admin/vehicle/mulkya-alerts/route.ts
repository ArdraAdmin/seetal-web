import {
  isVehicleStoreUnconfigured,
  listMulkyaExpiringSoon,
  requireVehicleUser,
} from "@/lib/server/vehicles";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET(req: Request) {
  try {
    requireVehicleUser(
      req.headers.get("authorization") || req.headers.get("Authorization"),
    );
    const vehicles = await listMulkyaExpiringSoon();
    return json({ vehicles });
  } catch (error) {
    if (isVehicleStoreUnconfigured(error)) {
      return json({ vehicles: [] });
    }
    const message =
      error instanceof Error ? error.message : "Unable to load mulkiya alerts";
    const status = message === "Not signed in" ? 401 : 400;
    return json({ error: message }, status);
  }
}

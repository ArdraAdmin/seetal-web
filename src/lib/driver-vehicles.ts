import type { Driver, Vehicle } from "./types";

export function vehicleNumberLabel(vehicle: Pick<Vehicle, "value">): string {
  return vehicle.value == null || vehicle.value === ""
    ? "Vehicle"
    : `#${vehicle.value}`;
}

export function isVehicleUnassigned(vehicle: Pick<Vehicle, "driverId">): boolean {
  return vehicle.driverId == null || String(vehicle.driverId).trim() === "";
}

/** Vehicles available in the driver form: unassigned, plus the one currently linked to this driver. */
export function vehiclesForDriverSelect(
  vehicles: Vehicle[],
  currentDriverId?: string | null,
): Vehicle[] {
  const current = currentDriverId?.trim() || "";
  return vehicles.filter(
    (vehicle) =>
      isVehicleUnassigned(vehicle) ||
      (current !== "" && String(vehicle.driverId) === current),
  );
}

export function vehicleLinkedToDriver(
  vehicles: Vehicle[],
  driverId: string,
): Vehicle | undefined {
  const id = driverId.trim();
  if (!id) return undefined;
  return vehicles.find((vehicle) => String(vehicle.driverId || "") === id);
}

export function driverVehicleFormError(input: {
  name: unknown;
  phone: unknown;
  vehicleId: unknown;
}): string | null {
  if (String(input.name ?? "").trim() === "") return "Enter a driver name";
  if (String(input.phone ?? "").trim() === "") return "Enter a phone number";
  if (String(input.vehicleId ?? "").trim() === "") return "Select a vehicle";
  return null;
}

/** Resolve the new driver id from create API response, or by matching after reload. */
export function resolveCreatedDriverId(
  created: unknown,
  drivers: Driver[],
  name: string,
  phone: string,
): string | null {
  if (typeof created === "string") {
    const text = created.trim();
    if (/^[a-f0-9]{24}$/i.test(text)) return text;
  }
  if (created && typeof created === "object") {
    const row = created as Record<string, unknown>;
    for (const key of ["_id", "id", "driverId"] as const) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  const matches = drivers.filter(
    (driver) => driver.name === name && driver.phoneNo === phone,
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1]!._id;
}

"use client";

import { VehiclesManager } from "@/components/VehiclesManager";

export default function ShmpVehiclesPage() {
  return (
    <VehiclesManager
      driversHref="/shmp/drivers"
      vehicleHref={(id) => `/shmp/vehicles/${id}`}
    />
  );
}

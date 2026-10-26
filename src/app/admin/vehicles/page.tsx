"use client";

import { VehiclesManager } from "@/components/VehiclesManager";

export default function VehiclesPage() {
  return (
    <VehiclesManager
      driversHref="/admin/drivers"
      vehicleHref={(id) => `/admin/vehicles/${id}`}
    />
  );
}

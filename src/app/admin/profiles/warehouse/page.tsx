"use client";

import { useCallback } from "react";
import { getWarehouseProfiles } from "@/lib/api";
import { ProfilesList } from "@/components/ProfilesList";

export default function WarehouseProfilesPage() {
  const fetcher = useCallback(() => getWarehouseProfiles(), []);
  return (
    <ProfilesList
      title="Warehouse profiles"
      role="Warehouse"
      editBase="/admin/profiles/warehouse"
      addHref="/admin/profiles/warehouse/new"
      addLabel="Add"
      fetcher={fetcher}
    />
  );
}

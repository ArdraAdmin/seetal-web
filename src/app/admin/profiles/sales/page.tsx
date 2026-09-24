"use client";

import { useCallback } from "react";
import { getSalesProfiles } from "@/lib/api";
import { ProfilesList } from "@/components/ProfilesList";

export default function SalesProfilesPage() {
  const fetcher = useCallback(() => getSalesProfiles(), []);
  return (
    <ProfilesList
      title="Sales profiles"
      role="Sales"
      editBase="/admin/profiles/sales"
      fetcher={fetcher}
    />
  );
}

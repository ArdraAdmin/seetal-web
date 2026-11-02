"use client";

import { Suspense } from "react";
import { WarehouseProfileForm } from "../profile-form";
import { LoadingState } from "@/components/ui";

export default function AddWarehouseProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <WarehouseProfileForm />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { WarehouseProfileForm } from "../profile-form";
import { LoadingState } from "@/components/ui";

export default function EditWarehouseProfilePage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<LoadingState />}>
      <WarehouseProfileForm profileId={params.id} />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { SalesProfileForm } from "../profile-form";
import { LoadingState } from "@/components/ui";

export default function EditSalesProfilePage() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<LoadingState />}>
      <SalesProfileForm profileId={params.id} />
    </Suspense>
  );
}

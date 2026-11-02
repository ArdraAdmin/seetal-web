"use client";

import { Suspense } from "react";
import { SalesProfileForm } from "../profile-form";
import { LoadingState } from "@/components/ui";

export default function AddSalesProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SalesProfileForm />
    </Suspense>
  );
}

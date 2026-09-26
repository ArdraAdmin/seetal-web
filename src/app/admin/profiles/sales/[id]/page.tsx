"use client";

import { useParams } from "next/navigation";
import { SalesProfileForm } from "../profile-form";

export default function EditSalesProfilePage() {
  const params = useParams<{ id: string }>();
  return <SalesProfileForm profileId={params.id} />;
}

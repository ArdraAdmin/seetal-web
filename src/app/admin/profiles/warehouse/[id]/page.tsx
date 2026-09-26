"use client";

import { useParams } from "next/navigation";
import { WarehouseProfileForm } from "../profile-form";

export default function EditWarehouseProfilePage() {
  const params = useParams<{ id: string }>();
  return <WarehouseProfileForm profileId={params.id} />;
}

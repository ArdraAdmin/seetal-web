"use client";

import { Suspense } from "react";
import { UserManagement } from "@/components/UserManagement";
import { LoadingState } from "@/components/ui";

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <UserManagement side="admin" />
    </Suspense>
  );
}

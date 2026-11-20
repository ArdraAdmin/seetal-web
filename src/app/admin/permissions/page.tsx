"use client";

import { EmptyState, PageHeader } from "@/components/ui";

export default function AdminPermissionsPage() {
  return (
    <div>
      <PageHeader title="Permissions" />
      <EmptyState
        title="Temporarily unavailable"
        description="This page is hidden for now. Module access for custom users is managed under User management."
      />
    </div>
  );
}

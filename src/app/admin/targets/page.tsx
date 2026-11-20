"use client";

import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui";

export default function AdminTargetsPage() {
  return (
    <div>
      <PageHeader
        title="Sales targets"
        subtitle="Targets are set on each sales profile under User management."
        actions={
          <Link
            href="/admin/users?group=sales"
            className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
          >
            Open User management
          </Link>
        }
      />
      <EmptyState
        title="Moved to User management"
        description="Open a sales user to set or update their STL and SHMP targets for the current month."
      />
    </div>
  );
}

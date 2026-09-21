"use client";

import { Card, PageHeader } from "@/components/ui";

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Product category structure."
      />
      <Card>
        <p className="text-sm text-slate-600">
          Category administration will be available here in a later release.
          Continue to use the existing process for creating and editing
          categories until then.
        </p>
      </Card>
    </div>
  );
}

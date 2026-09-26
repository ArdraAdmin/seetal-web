"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoadingState, PageHeader } from "@/components/ui";
import { InventoryBulkUpload } from "../bulk-upload";
import { ProductForm } from "../product-form";

function AddProductView() {
  const params = useSearchParams();
  const bulk = params.get("mode") === "bulk";

  return (
    <div>
      <PageHeader
        title={bulk ? "Bulk upload" : "Add product"}
        subtitle={
          bulk
            ? "Upload an Excel (.xlsx) or CSV file to add or update catalogue items."
            : "Create a single catalogue item, or switch to bulk upload for a spreadsheet."
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/inventory/new"
          className={`inline-flex min-h-10 items-center rounded-lg border px-4 py-2 text-sm font-medium ${
            bulk
              ? "border-line bg-white text-slate-700 hover:bg-[#f7f5f0]"
              : "border-brand bg-brand text-ink"
          }`}
        >
          Add one product
        </Link>
        <Link
          href="/admin/inventory/new?mode=bulk"
          className={`inline-flex min-h-10 items-center rounded-lg border px-4 py-2 text-sm font-medium ${
            bulk
              ? "border-brand bg-brand text-ink"
              : "border-line bg-white text-slate-700 hover:bg-[#f7f5f0]"
          }`}
        >
          Bulk upload
        </Link>
      </div>
      {bulk ? <InventoryBulkUpload /> : <ProductForm />}
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AddProductView />
    </Suspense>
  );
}


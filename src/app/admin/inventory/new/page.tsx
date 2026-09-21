"use client";

import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

export default function AddProductPage() {
  return (
    <div>
      <PageHeader
        title="Add product"
        subtitle="Create a catalogue item with stock, unit, and pricing details."
      />
      <ProductForm />
    </div>
  );
}

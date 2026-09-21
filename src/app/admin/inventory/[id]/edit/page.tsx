"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProduct } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui";
import { ProductForm } from "../../product-form";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load product");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <PageHeader
        title="Edit product"
        subtitle="Update catalogue details, stock, and pricing."
      />
      {loading ? (
        <LoadingState label="Loading product…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : product ? (
        <ProductForm product={product} />
      ) : (
        <ErrorState message="Product not found" />
      )}
    </div>
  );
}

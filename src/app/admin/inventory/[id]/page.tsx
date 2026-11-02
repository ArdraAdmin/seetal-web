"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { getProduct } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { portalFieldVisible } from "@/lib/custom-users";
import { salesMoney } from "@/lib/sales";
import { productImageUrls } from "@/lib/product-image";
import { ProductImageGallery } from "@/components/ProductImage";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}

function companyName(product: Product) {
  const company = product.company;
  if (company && typeof company === "object") {
    return String(company.name || company.prefix || "");
  }
  return "";
}

function categoryName(product: Product) {
  const category = product.category;
  if (!category || typeof category !== "object") return "";
  const record = category as {
    masterCategoryName?: string;
    masterCategory?: string;
    subCategory?: string;
  };
  return [record.masterCategoryName || record.masterCategory, record.subCategory]
    .filter(Boolean)
    .join(" / ");
}

export default function InventoryItemPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const showPrice = portalFieldVisible(user?.customAccess, "selling", "inventory", "selling-price");
  const showQty = portalFieldVisible(user?.customAccess, "selling", "inventory", "quantity");
  const id = String(params?.id || "");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyProduct = useCallback((data: Product) => {
    setProduct(data);
    setError(null);
    setLoading(false);
  }, []);

  const applyError = useCallback((e: unknown) => {
    setProduct(null);
    setError(e instanceof Error ? e.message : "Failed to load product");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getProduct(id)
      .then((data) => {
        if (!cancelled) applyProduct(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) applyError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [id, applyProduct, applyError]);

  const imageCount = product ? productImageUrls(product.imagePath).length : 0;

  return (
    <div>
      <PageHeader
        title={product?.itemName || "Inventory item"}
        subtitle={
          product
            ? `Ref ${product.itemRef || "—"} · ${imageCount} image${imageCount === 1 ? "" : "s"}`
            : "Product details"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/inventory"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Back to inventory
            </Link>
            {product ? (
              <Link
                href={`/admin/inventory/${product._id}/edit`}
                className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
              >
                Edit
              </Link>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading product…" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            void getProduct(id).then(applyProduct).catch(applyError);
          }}
        />
      ) : !product ? (
        <ErrorState message="Product not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 text-sm font-semibold text-ink">Product images</h2>
            <p className="mb-4 text-sm text-slate-500">
              All images for this product. Image 1 is the thumbnail shown in
              the inventory list.
            </p>
            <ProductImageGallery
              name={product.itemName || "Product"}
              imagePath={product.imagePath}
            />
          </Card>
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">
              Product details
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Item name" value={product.itemName} />
              <DetailField label="Item ref" value={product.itemRef} />
              <DetailField
                label="Barcode"
                value={product.barCode || product.barcode}
              />
              <DetailField label="Category" value={categoryName(product)} />
              <DetailField label="Company" value={companyName(product)} />
              <DetailField label="Unit" value={product.unit} />
              <DetailField label="Ratio" value={product.ratio} />
              {showPrice ? (
              <DetailField
                label="Selling price"
                value={salesMoney(Number(product.sellingPrice) || 0)}
              />
              ) : null}
              {showQty ? (
              <DetailField
                label="Quantity (cartons)"
                value={product.inQty?.amountInCartons ?? 0}
              />
              ) : null}
              {showQty ? (
              <DetailField
                label="Quantity (units)"
                value={product.inQty?.amountInUnits ?? 0}
              />
              ) : null}
              <DetailField
                label="Display in catalog"
                value={product.isDisplay === false ? "Hidden" : "Visible"}
              />
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteProduct,
  exportInventory,
  getProductsPaged,
  searchProducts,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

const PAGE_SIZES = [10, 20, 50, 100, 1000] as const;

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [exporting, setExporting] = useState(false);
  const [searchHits, setSearchHits] = useState<Product[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (p: number, size: number, hits: Product[] | null) => {
      setLoading(true);
      setError(null);
      try {
        if (hits) {
          setProducts(hits.slice((p - 1) * size, p * size));
        } else {
          const data = await getProductsPaged(p, size);
          setProducts(data);
        }
        setPage(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(1, pageSize, null);
    // Initial catalogue fetch only; later paging uses load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function onSearch() {
    if (!query.trim()) {
      setSearchHits(null);
      await load(1, pageSize, null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchProducts(query.trim());
      const hits = Array.isArray(data) ? data : [];
      setSearchHits(hits);
      setProducts(hits.slice(0, pageSize));
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      toast("Product deleted", "success");
      if (searchHits) {
        const nextHits = searchHits.filter((item) => item._id !== id);
        setSearchHits(nextHits);
        await load(page, pageSize, nextHits);
      } else {
        await load(page, pageSize, null);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  async function onExport() {
    if (!user?.id) return;
    if (
      !confirm(
        "Export inventory to Excel and email it to noreply@shrseetal.com?",
      )
    ) {
      return;
    }
    setExporting(true);
    try {
      await exportInventory(user.id);
      toast("An email will be sent shortly", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  function onPageSizeChange(size: (typeof PAGE_SIZES)[number]) {
    setPageSize(size);
    void load(1, size, searchHits);
  }

  const hasPrev = page > 1;
  const hasNext = searchHits
    ? page * pageSize < searchHits.length
    : products.length === pageSize;

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Product catalogue, stock quantities, and pricing."
        actions={
          <>
            <SecondaryButton
              type="button"
              disabled={exporting}
              onClick={() => void onExport()}
            >
              {exporting ? "Exporting…" : "Export"}
            </SecondaryButton>
            <Link
              href="/admin/inventory/new?mode=bulk"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Bulk upload
            </Link>
            <Link
              href="/admin/inventory/new"
              className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
            >
              Add product
            </Link>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
            <TextField
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Item name or ref"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearch();
              }}
            />
          </div>
          <PrimaryButton type="button" onClick={() => void onSearch()}>
            Search
          </PrimaryButton>
        </div>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => void load(page, pageSize, searchHits)}
        />
      ) : products.length === 0 ? (
        <EmptyState title="No products found" />
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card
              key={p._id}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {p.itemName || "Unnamed"}
                </p>
                <p className="text-sm text-slate-500">
                  Ref: {p.itemRef || "—"} · {p.unit || "—"} · ₹
                  {p.sellingPrice ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Qty: {p.inQty?.amountInCartons ?? 0} CTN /{" "}
                  {p.inQty?.amountInUnits ?? 0} units
                  {p.isDisplay === false ? " · Hidden" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/inventory/${p._id}/edit`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                >
                  Edit
                </Link>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() => void onDelete(p._id)}
                >
                  Delete
                </SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!error ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Rows</span>
            <select
              value={pageSize}
              onChange={(e) =>
                onPageSizeChange(
                  Number(e.target.value) as (typeof PAGE_SIZES)[number],
                )
              }
              className="min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  Show {size} products
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              type="button"
              disabled={!hasPrev || loading}
              onClick={() => void load(page - 1, pageSize, searchHits)}
            >
              Prev
            </SecondaryButton>
            <span className="px-2 text-sm text-slate-600">Page {page}</span>
            <SecondaryButton
              type="button"
              disabled={!hasNext || loading}
              onClick={() => void load(page + 1, pageSize, searchHits)}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

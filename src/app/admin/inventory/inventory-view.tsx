"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProduct,
  exportInventory,
  getCompanies,
  getCompanyProducts,
  getProductsPaged,
  searchProducts,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { salesMoney } from "@/lib/sales";
import { companyKeysWithModule, portalFieldVisible } from "@/lib/custom-users";
import {
  INVENTORY_COMPANY_KEYS,
  inventoryCompanyLabel,
  type InventoryCompanyKey,
} from "@/lib/inventory-companies";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import { useAuth } from "@/components/AuthProvider";
import { ProductThumb } from "@/components/ProductImage";
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

function toProduct(row: {
  _id: string;
  itemName?: string;
  itemRef?: string;
  company?: string;
  imagePath?: string | string[];
  unit?: string;
  ratio?: number;
  sellingPrice?: number;
  isDisplay?: boolean;
  barCode?: string;
  barcode?: string;
  inQty?: { amountInCartons?: number; amountInUnits?: number };
}): Product {
  return {
    _id: row._id,
    itemName: row.itemName,
    itemRef: row.itemRef,
    company: row.company,
    imagePath: row.imagePath,
    unit: row.unit,
    ratio: row.ratio,
    sellingPrice: row.sellingPrice,
    isDisplay: row.isDisplay,
    barCode: row.barCode,
    barcode: row.barcode,
    inQty: row.inQty,
  };
}

export function InventoryView({
  companyKey,
}: {
  companyKey: InventoryCompanyKey | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const showPrice = portalFieldVisible(user?.customAccess, "selling", "inventory", "selling-price");
  const showQty = portalFieldVisible(user?.customAccess, "selling", "inventory", "quantity");
  const allowed = useMemo(() => {
    if (!user?.customAccess) return [...INVENTORY_COMPANY_KEYS];
    const enabled = new Set(companyKeysWithModule(user.customAccess, "inventory"));
    return INVENTORY_COMPANY_KEYS.filter((key) => enabled.has(key));
  }, [user?.customAccess]);
  const denied = Boolean(companyKey && user?.customAccess && !allowed.includes(companyKey));
  const requestId = useRef(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const load = useCallback(
    async (p: number, size: number, search: string) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        if (!companyKey) {
          if (search) {
            const hits = await searchProducts(search);
            if (id !== requestId.current) return;
            const start = (p - 1) * size;
            setProducts(hits.slice(start, start + size));
            setTotal(hits.length);
            setHasMore(start + size < hits.length);
          } else {
            const data = await getProductsPaged(p, size);
            if (id !== requestId.current) return;
            setProducts(data);
            setTotal(null);
            setHasMore(data.length === size);
          }
          return;
        }

        const companies = await getCompanies();
        const resolved = resolveSalesCompanyByKey(companyKey, companies);
        if (!resolved) {
          throw new Error(`${inventoryCompanyLabel(companyKey)} company was not found`);
        }
        const data = await getCompanyProducts(resolved.id, p, size, search);
        if (id !== requestId.current) return;
        if (data.products.length === 0 && p > 1) {
          setPage(p - 1);
          return;
        }
        setProducts(data.products.map(toProduct));
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [companyKey],
  );

  useEffect(() => {
    if (denied) {
      setLoading(false);
      setProducts([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    void load(page, pageSize, submittedQuery);
  }, [denied, page, pageSize, submittedQuery, load]);

  async function onSearch() {
    const next = query.trim();
    if (page === 1 && next === submittedQuery) {
      await load(1, pageSize, next);
      return;
    }
    setPage(1);
    setSubmittedQuery(next);
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      toast("Product deleted", "success");
      await load(page, pageSize, submittedQuery);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  async function onExport() {
    if (!user?.id) return;
    const label = companyKey ? inventoryCompanyLabel(companyKey) : "full";
    if (
      !confirm(
        `Export ${label} inventory to Excel and email it to noreply@shrseetal.com?`,
      )
    ) {
      return;
    }
    setExporting(true);
    try {
      let companyId: string | undefined;
      if (companyKey) {
        const companies = await getCompanies();
        const resolved = resolveSalesCompanyByKey(companyKey, companies);
        if (!resolved) {
          throw new Error(`${inventoryCompanyLabel(companyKey)} company was not found`);
        }
        companyId = resolved.id;
      }
      await exportInventory(user.id, companyId);
      toast("An email will be sent shortly", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  function onPageSizeChange(size: (typeof PAGE_SIZES)[number]) {
    setPageSize(size);
    setPage(1);
  }

  const label = companyKey ? inventoryCompanyLabel(companyKey) : "Inventory";
  const addHref = companyKey
    ? `/admin/inventory/new?company=${companyKey}`
    : "/admin/inventory/new";
  const hasPrev = page > 1;

  if (denied) {
    return <EmptyState title="This catalogue is not available for this account" />;
  }

  return (
    <div>
      <PageHeader
        title={companyKey ? `${label} inventory` : "Inventory"}
        subtitle={
          companyKey
            ? `${label} product catalogue, stock quantities, and pricing.`
            : "Product catalogue, stock quantities, and pricing."
        }
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
              href={addHref}
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
          onRetry={() => void load(page, pageSize, submittedQuery)}
        />
      ) : products.length === 0 ? (
        <EmptyState
          title={
            submittedQuery
              ? `No ${label} products match that search`
              : `No ${label} products found`
          }
        />
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card
              key={p._id}
              className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <ProductThumb
                  imagePath={p.imagePath}
                  name={p.itemName || "Product"}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {p.itemName || "Unnamed"}
                  </p>
                  <p className="text-sm text-slate-500">
                    Ref: {p.itemRef || "—"} · {p.unit || "—"}
                    {showPrice ? ` · ${salesMoney(Number(p.sellingPrice) || 0)}` : ""}
                  </p>
                  {showQty ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Qty: {p.inQty?.amountInCartons ?? 0} CTN /{" "}
                      {p.inQty?.amountInUnits ?? 0} units
                      {p.isDisplay === false ? " · Hidden" : ""}
                    </p>
                  ) : p.isDisplay === false ? (
                    <p className="mt-1 text-xs text-slate-500">Hidden</p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/inventory/${p._id}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                >
                  View
                </Link>
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
            {total != null ? (
              <span className="whitespace-nowrap text-slate-500">
                {total.toLocaleString()} products
              </span>
            ) : null}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              type="button"
              disabled={!hasPrev || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </SecondaryButton>
            <span className="px-2 text-sm text-slate-600">Page {page}</span>
            <SecondaryButton
              type="button"
              disabled={!hasMore || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

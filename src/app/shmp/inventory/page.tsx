"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  getCategories,
  getCompanies,
  type CompanyRecord,
} from "@/lib/api";
import { parseCategoryGroups, type CategoryGroup } from "@/lib/categories";
import { salesMoney } from "@/lib/sales";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  baseItemCodeOf,
  isFreshShmpInventory,
  rememberOwnShmpInventoryId,
  shmpCreateInventory,
  shmpDeleteInventory,
  shmpInventory,
  shmpStores,
  type ShmpInventoryProduct,
  type ShmpStore,
} from "@/lib/shmp-api";
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
import {
  ProductFields,
  blankForm,
  buildPayload,
  companyNameOf,
  type ProductFormState,
  EMPTY_FORM,
} from "./product-form";

export default function ShmpInventoryPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ShmpInventoryProduct[]>([]);
  const [stores, setStores] = useState<ShmpStore[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ProductFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setLoadingCategories(true);
    setLoadingCompanies(true);
    try {
      const [cats, comps, storeList] = await Promise.all([
        getCategories().catch(() => []),
        getCompanies().catch(() => [] as CompanyRecord[]),
        shmpStores().catch(() => [] as ShmpStore[]),
      ]);
      setGroups(parseCategoryGroups(cats));
      setCompanies(Array.isArray(comps) ? comps : []);
      setStores(Array.isArray(storeList) ? storeList : []);
    } finally {
      setLoadingCategories(false);
      setLoadingCompanies(false);
    }
  }, []);

  const shmpCompanyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";
  const visibleProducts = useMemo(
    () => products.filter((product) => isFreshShmpInventory(product)),
    [products],
  );

  const load = useCallback(async (search = query) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        ownOnly: "1",
        excludeStl: "1",
      };
      if (search.trim()) params.q = search.trim();
      if (shmpCompanyId) params.companyId = shmpCompanyId;
      const list = await shmpInventory(params);
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [query, shmpCompanyId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void load("");
    // Initial catalogue fetch only; later searches use load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shmpCompanyId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const payload = buildPayload(addForm, groups);
    if (!payload.ok) {
      toast(payload.error, "info");
      return;
    }
    setCreating(true);
    try {
      const created = await shmpCreateInventory(payload.data);
      if (created?._id) rememberOwnShmpInventoryId(created._id);
      toast("Product created", "success");
      setAddForm(blankForm(shmpCompanyId));
      setAdding(false);
      await load();
      if (created?._id) {
        setProducts((prev) =>
          prev.some((item) => item._id === created._id)
            ? prev
            : [created, ...prev],
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Create failed", "error");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(product: ShmpInventoryProduct) {
    if (!confirm(`Delete ${product.itemName || product.itemRef || "product"}?`)) {
      return;
    }
    setDeletingId(product._id);
    try {
      await shmpDeleteInventory(product._id);
      toast("Product deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Blank SHMP catalogue. Add production products with base item code and store prices."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() => {
                setAdding((open) => {
                  if (!open) setAddForm(blankForm(shmpCompanyId));
                  return !open;
                });
              }}
            >
              {adding ? "Close add" : "Add product"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      {adding ? (
        <Card className="mb-5">
          <p className="mb-3 text-sm font-semibold text-ink">Add product</p>
          <form onSubmit={onCreate} className="space-y-4">
            <ProductFields
              form={addForm}
              setForm={setAddForm}
              groups={groups}
              companies={companies}
              stores={stores}
              loadingCategories={loadingCategories}
              loadingCompanies={loadingCompanies}
            />
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create product"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={creating}
                onClick={() => {
                  setAddForm(blankForm(shmpCompanyId));
                  setAdding(false);
                }}
              >
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
            <TextField
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Item name, ref, or item code"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
          </div>
          <PrimaryButton type="button" onClick={() => void load()}>
            Search
          </PrimaryButton>
        </div>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="SHMP starts with a blank catalogue. Add a product to begin."
        />
      ) : (
        <div className="space-y-3">
          {visibleProducts.map((product) => {
            const profiles = product.storeProfileList || [];
            const baseCode = baseItemCodeOf(product);
            return (
              <Card
                key={product._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {product.itemName || "Unnamed"}
                  </p>
                  <p className="text-sm text-slate-500">
                    Ref: {product.itemRef || "—"}
                    {baseCode ? ` · Code: ${baseCode}` : ""} ·{" "}
                    {product.unit || "—"} ·{" "}
                    {salesMoney(Number(product.sellingPrice) || 0)}
                    {companyNameOf(product)
                      ? ` · ${companyNameOf(product)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Qty: {product.inQty?.amountInCartons ?? 0} CTN /{" "}
                    {product.inQty?.amountInUnits ?? 0} units
                    {product.isDisplay === false ? " · Hidden" : ""}
                    {profiles.length
                      ? ` · ${profiles.length} store price${profiles.length === 1 ? "" : "s"}`
                      : " · No store prices"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/shmp/inventory/${product._id}`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    View
                  </Link>
                  <Link
                    href={`/shmp/inventory/${product._id}?edit=1`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    Edit
                  </Link>
                  <SecondaryButton
                    type="button"
                    className="border-red-200 text-red-700"
                    disabled={deletingId === product._id}
                    onClick={() => void onDelete(product)}
                  >
                    {deletingId === product._id ? "Deleting…" : "Delete"}
                  </SecondaryButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

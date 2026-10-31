"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getCategories,
  getCompanies,
  uploadProductImage,
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
import { ProductImageField, ProductThumb } from "@/components/ProductImage";
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
  catalogueRequestIsCurrent,
  shmpCatalogueParams,
} from "./catalogue-load";
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
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalogueRequest = useRef<AbortController | null>(null);
  const catalogueRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ProductFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);

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
      setCompaniesLoaded(true);
    }
  }, []);

  const shmpCompanyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";
  const visibleProducts = useMemo(
    () => products.filter((product) => isFreshShmpInventory(product)),
    [products],
  );

  const load = useCallback(async (search = query) => {
    if (!shmpCompanyId) return;
    catalogueRequest.current?.abort();
    const controller = new AbortController();
    catalogueRequest.current = controller;
    const requestId = ++catalogueRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const list = await shmpInventory(
        shmpCatalogueParams(search, shmpCompanyId),
        controller.signal,
      );
      if (
        !catalogueRequestIsCurrent(
          requestId,
          catalogueRequestId.current,
          controller.signal.aborted,
        )
      ) {
        return;
      }
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      if (
        !catalogueRequestIsCurrent(
          requestId,
          catalogueRequestId.current,
          controller.signal.aborted,
        )
      ) {
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      if (
        catalogueRequestIsCurrent(
          requestId,
          catalogueRequestId.current,
          controller.signal.aborted,
        )
      ) {
        setLoading(false);
      }
    }
  }, [query, shmpCompanyId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!companiesLoaded) return;
    if (!shmpCompanyId) {
      setLoading(false);
      setProducts([]);
      setError("SHMP company was not found.");
      return;
    }
    void load("");
    return () => {
      catalogueRequest.current?.abort();
    };
    // Initial catalogue fetch only; later searches use load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesLoaded, shmpCompanyId]);

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
      if (pendingImages.length > 0 && created?._id) {
        try {
          let savedPath: string | string[] | undefined;
          for (const file of pendingImages) {
            const saved = await uploadProductImage(created._id, file);
            savedPath = saved.imagePath;
          }
          if (savedPath !== undefined) created.imagePath = savedPath;
        } catch (imageError) {
          toast(
            imageError instanceof Error
              ? `Product saved, but the image upload failed: ${imageError.message}`
              : "Product saved, but the image upload failed",
            "error",
          );
        }
      }
      toast("Product created", "success");
      setPendingImages([]);
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
        subtitle="Blank SHMP catalogue. Add production products, then choose which stores they are visible in."
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
              disabled={loading || !companiesLoaded}
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
            <ProductImageField
              itemName={addForm.itemName}
              onPendingFiles={setPendingImages}
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
                  setPendingImages([]);
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
          <PrimaryButton
            type="button"
            disabled={!companiesLoaded}
            onClick={() => void load()}
          >
            Search
          </PrimaryButton>
        </div>
      </Card>

      {!companiesLoaded || loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            if (!shmpCompanyId) {
              setLoading(true);
              setError(null);
              setCompaniesLoaded(false);
              void loadMeta();
              return;
            }
            void load();
          }}
        />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="SHMP starts with a blank catalogue. Add a product to begin."
        />
      ) : (
        <div className="space-y-3">
          {visibleProducts.map((product) => {
            const profiles = product.storeProfileList || [];
            const visibleStoreCount = profiles.filter(
              (row) => row.isDisplayed !== false,
            ).length;
            const baseCode = baseItemCodeOf(product);
            return (
              <Card
                key={product._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <ProductThumb
                    imagePath={product.imagePath}
                    name={product.itemName || "Product"}
                  />
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
                    {visibleStoreCount
                      ? ` · Visible in ${visibleStoreCount} store${visibleStoreCount === 1 ? "" : "s"}`
                      : " · Not visible in any store"}
                  </p>
                </div>
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

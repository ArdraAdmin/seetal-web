"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getCategories,
  getCompanies,
  type CompanyRecord,
} from "@/lib/api";
import { parseCategoryGroups, type CategoryGroup } from "@/lib/categories";
import { salesMoney } from "@/lib/sales";
import {
  baseItemCodeOf,
  shmpDeleteInventory,
  shmpInventoryProduct,
  shmpStores,
  shmpUpdateInventory,
  type ShmpInventoryProduct,
  type ShmpStore,
} from "@/lib/shmp-api";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import {
  ProductFields,
  buildPayload,
  companyNameOf,
  formFromProduct,
  matchCategory,
  storeIdOf,
  storeNameOf,
  type ProductFormState,
} from "../product-form";

function formatWhen(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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

export default function ShmpInventoryItemPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading product…" />}>
      <InventoryItemDetail />
    </Suspense>
  );
}

function InventoryItemDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = String(params?.id || "");

  const [product, setProduct] = useState<ShmpInventoryProduct | null>(null);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [stores, setStores] = useState<ShmpStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await shmpInventoryProduct(id);
      setProduct(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    setLoadingCompanies(true);
    void Promise.all([
      getCategories().catch(() => []),
      getCompanies().catch(() => [] as CompanyRecord[]),
      shmpStores().catch(() => [] as ShmpStore[]),
    ]).then(([cats, comps, storeList]) => {
      if (cancelled) return;
      setGroups(parseCategoryGroups(cats));
      setCompanies(Array.isArray(comps) ? comps : []);
      setStores(Array.isArray(storeList) ? storeList : []);
      setLoadingCategories(false);
      setLoadingCompanies(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (product) setEditForm(formFromProduct(product, groups));
  }, [product, groups]);

  function startEdit() {
    if (!product) return;
    setEditForm(formFromProduct(product, groups));
    setEditing(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    const payload = buildPayload(editForm, groups);
    if ("error" in payload) {
      toast(payload.error, "info");
      return;
    }
    setSaving(true);
    try {
      const updated = await shmpUpdateInventory(id, payload);
      setProduct(updated);
      setEditing(false);
      toast("Product updated", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!product) return;
    if (!confirm(`Delete ${product.itemName || product.itemRef || "product"}?`)) {
      return;
    }
    setDeleting(true);
    try {
      await shmpDeleteInventory(product._id);
      toast("Product deleted", "success");
      router.push("/shmp/inventory");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
      setDeleting(false);
    }
  }

  const category = product ? matchCategory(product, groups) : null;
  const profiles = product?.storeProfileList || [];
  const baseCode = product ? baseItemCodeOf(product) : "";

  return (
    <div>
      <PageHeader
        title={product?.itemName || "Inventory item"}
        subtitle={
          product
            ? `Ref ${product.itemRef || "—"} · full product details`
            : "Product details"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shmp/inventory"
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
            >
              Back to inventory
            </Link>
            {product && !editing ? (
              <>
                <SecondaryButton type="button" onClick={startEdit}>
                  Edit
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  disabled={deleting}
                  onClick={() => void onDelete()}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </SecondaryButton>
              </>
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading product…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !product ? (
        <ErrorState message="Product not found" />
      ) : editing && editForm ? (
        <Card>
          <form onSubmit={onSave} className="space-y-4">
            <ProductFields
              form={editForm}
              setForm={setEditForm}
              groups={groups}
              companies={companies}
              stores={stores}
              loadingCategories={loadingCategories}
              loadingCompanies={loadingCompanies}
            />
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">
              Product details
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Item name" value={product.itemName} />
              <DetailField label="Item ref" value={product.itemRef} />
              <DetailField label="Base item code" value={baseCode} />
              <DetailField
                label="Barcode"
                value={product.barCode || product.barcode}
              />
              <DetailField
                label="Category"
                value={category?.categoryName}
              />
              <DetailField
                label="Sub category"
                value={category?.subCategoryName}
              />
              <DetailField
                label="Company"
                value={companyNameOf(product)}
              />
              <DetailField label="Unit" value={product.unit} />
              <DetailField label="Ratio" value={product.ratio} />
              <DetailField
                label="Base selling price"
                value={salesMoney(Number(product.sellingPrice) || 0)}
              />
              <DetailField
                label="Quantity (cartons)"
                value={product.inQty?.amountInCartons ?? 0}
              />
              <DetailField
                label="Quantity (units)"
                value={product.inQty?.amountInUnits ?? 0}
              />
              <DetailField
                label="Display in catalog"
                value={product.isDisplay === false ? "Hidden" : "Visible"}
              />
              <DetailField label="Description" value={product.description} />
              <DetailField label="Dimensions" value={product.dimensions} />
              <DetailField label="Weight" value={product.weight} />
              <DetailField
                label="Created"
                value={formatWhen(product.createdAt)}
              />
              <DetailField
                label="Updated"
                value={formatWhen(product.updatedAt)}
              />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">
              Store pricing
            </h2>
            {profiles.length === 0 ? (
              <p className="text-sm text-slate-500">No store prices assigned.</p>
            ) : (
              <ul className="divide-y divide-line">
                {profiles.map((row, index) => (
                  <li
                    key={`${storeIdOf(row.store)}-${index}`}
                    className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {storeNameOf(row.store) ||
                          storeIdOf(row.store) ||
                          "Store"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Item code: {row.storeItemCode || "—"}
                        {row.isDisplayed === false ? " · Hidden" : ""}
                      </p>
                    </div>
                    <p className="font-medium text-ink">
                      {salesMoney(Number(row.storePrice) || 0)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

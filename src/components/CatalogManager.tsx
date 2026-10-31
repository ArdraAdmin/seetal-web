"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  getCatalogTemplateStatus,
  getCompanies,
  getCompanyProducts,
  previewCatalogImage,
  uploadProductImage,
  type CompanyProduct,
} from "@/lib/api";
import { productBelongsToCompany, productImageFileError } from "@/lib/product-image";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  isFreshShmpInventory,
  shmpInventory,
  type ShmpInventoryProduct,
} from "@/lib/shmp-api";
import { useToast } from "./Toast";
import { ProductThumb } from "./ProductImage";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "./ui";

type CatalogPlatform = "stl" | "shmp";

type CatalogItem = {
  id: string;
  name: string;
  ref: string;
  imagePath?: unknown;
};

function asCatalogItem(
  product: CompanyProduct | ShmpInventoryProduct,
): CatalogItem {
  return {
    id: product._id,
    name: String(product.itemName || "Unnamed"),
    ref: String(product.itemRef || ""),
    imagePath: product.imagePath,
  };
}

export function CatalogManager({ platform }: { platform: CatalogPlatform }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [rawUrl, setRawUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const rawUrlRef = useRef("");
  const previewUrlRef = useRef("");
  const previewBlobRef = useRef<Blob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    return () => {
      if (rawUrlRef.current) URL.revokeObjectURL(rawUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function rememberRaw(file: File | null) {
    if (rawUrlRef.current) URL.revokeObjectURL(rawUrlRef.current);
    const url = file ? URL.createObjectURL(file) : "";
    rawUrlRef.current = url;
    setRawFile(file);
    setRawUrl(url);
  }

  function rememberPreview(blob: Blob | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = blob ? URL.createObjectURL(blob) : "";
    previewUrlRef.current = url;
    previewBlobRef.current = blob;
    setPreviewUrl(url);
  }

  async function load(nextPage: number, search: string) {
    setLoading(true);
    setError(null);
    try {
      const [template, companies] = await Promise.all([
        getCatalogTemplateStatus()
          .then((status) => status.ready)
          .catch(() => null),
        getCompanies().catch(() => []),
      ]);
      setTemplateReady(template);
      if (platform === "stl") {
        const stl = resolveSalesCompanyByKey("stl", companies);
        if (!stl?.id) throw new Error("STL company was not found");
        const result = await getCompanyProducts(stl.id, nextPage, 50, search);
        setItems(
          result.products
            .filter(
              (product) =>
                !product.company ||
                productBelongsToCompany(product.company, stl.id),
            )
            .map(asCatalogItem),
        );
        setPage(result.page);
        setHasMore(result.hasMore);
      } else {
        const shmp = resolveSalesCompanyByKey("shmp", companies);
        const params: Record<string, string> = { ownOnly: "1", excludeStl: "1" };
        if (search.trim()) params.q = search.trim();
        if (shmp?.id) params.companyId = shmp.id;
        const list = await shmpInventory(params);
        const fresh = (Array.isArray(list) ? list : []).filter((product) =>
          isFreshShmpInventory(product),
        );
        setItems(fresh.map(asCatalogItem));
        setPage(1);
        setHasMore(false);
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Search calls load() directly. This fetch runs when the catalog screen opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setSelectedId("");
    clearGenerated();
    void load(1, query);
  }

  function clearGenerated() {
    rememberPreview(null);
  }

  function selectItem(id: string) {
    setSelectedId(id);
    clearGenerated();
  }

  function chooseRaw(file: File | null) {
    if (file) {
      const message = productImageFileError(file);
      if (message) {
        toast(message, "error");
        return;
      }
    }
    rememberRaw(file);
    clearGenerated();
  }

  async function onGenerate() {
    if (!selected || !rawFile) return;
    setGenerating(true);
    try {
      const blob = await previewCatalogImage(selected.id, rawFile);
      rememberPreview(blob);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Image generation failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function onSave() {
    const preview = previewBlobRef.current;
    if (!selected || !preview) return;
    setSaving(true);
    try {
      const saved = await uploadProductImage(
        selected.id,
        preview,
        `${selected.ref || selected.id}.jpg`,
        { slot: 0 },
      );
      setItems((current) =>
        current.map((item) =>
          item.id === selected.id ? { ...item, imagePath: saved.imagePath } : item,
        ),
      );
      toast("Generated image saved to the inventory item", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save the image", "error");
    } finally {
      setSaving(false);
    }
  }

  const title = platform === "stl" ? "STL catalog" : "SHMP catalog";
  const subtitle =
    platform === "stl"
      ? "Generate a product image for an STL inventory item, preview it, then save it onto that item."
      : "Generate a product image for an SHMP inventory item, preview it, then save it onto that item.";

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      {templateReady === false ? (
        <Card className="mb-5">
          <p className="text-sm text-slate-700">
            The catalog template image is not installed yet. Generation stays
            off until that template is added. You can still upload a finished
            product image from the inventory item.
          </p>
        </Card>
      ) : null}
      {templateReady === null && !loading && !error ? (
        <Card className="mb-5">
          <p className="text-sm text-slate-700">
            Image generation is not available from this API yet.
          </p>
        </Card>
      ) : null}

      <Card className="mb-5">
        <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
            <TextField
              label="Find an item"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Item name or ref"
            />
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            Search
          </PrimaryButton>
        </form>
      </Card>

      {loading ? (
        <LoadingState label="Loading inventory…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(page, query)} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No inventory items"
          description={
            platform === "stl"
              ? "No STL company products matched this search."
              : "No SHMP inventory products matched this search."
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <div className="space-y-3">
            {items.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left ${
                    active ? "border-brand ring-1 ring-brand" : "border-line"
                  }`}
                >
                  <ProductThumb imagePath={item.imagePath} name={item.name} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">
                      {item.name}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {item.ref || "No ref"}
                    </span>
                  </span>
                </button>
              );
            })}
            {platform === "stl" ? (
              <div className="flex items-center justify-between gap-2 pt-2">
                <SecondaryButton
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => void load(page - 1, query)}
                >
                  Previous
                </SecondaryButton>
                <span className="text-sm text-slate-600">Page {page}</span>
                <SecondaryButton
                  type="button"
                  disabled={!hasMore || loading}
                  onClick={() => void load(page + 1, query)}
                >
                  Next
                </SecondaryButton>
              </div>
            ) : null}
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-ink">Generate image</h2>
            {selected ? (
              <p className="mt-1 text-sm text-slate-600">
                {selected.name}
                {selected.ref ? ` · ${selected.ref}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Select an inventory item.</p>
            )}
            <label className="mt-4 block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Raw product image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={!selected}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 disabled:opacity-50"
                onChange={(event) => chooseRaw(event.target.files?.[0] ?? null)}
              />
            </label>
            {rawUrl ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Raw upload
                </p>
                {/* Local preview of the file the admin just chose. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={rawUrl}
                  alt="Raw product upload"
                  className="h-36 w-full rounded-lg border border-line object-contain"
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                disabled={!selected || !rawFile || templateReady !== true || generating}
                onClick={() => void onGenerate()}
              >
                {generating ? "Generating…" : "Generate image"}
              </PrimaryButton>
            </div>
            {previewUrl ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Preview
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Generated catalog preview"
                  className="w-full rounded-lg border border-line object-contain"
                />
                <PrimaryButton
                  type="button"
                  className="mt-3"
                  disabled={saving}
                  onClick={() => void onSave()}
                >
                  {saving ? "Saving…" : "Save to inventory"}
                </PrimaryButton>
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}

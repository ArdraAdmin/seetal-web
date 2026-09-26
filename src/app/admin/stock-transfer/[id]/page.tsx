"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  companyLabel,
  getAllCompanyProducts,
  getCompanies,
  transferProductsToCompany,
  type CompanyProduct,
  type CompanyRecord,
} from "@/lib/api";
import { useToast } from "@/components/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

const PAGE_SIZE = 100;

export default function StockTransferProductsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const sourceId = params.id;
  const named = searchParams.get("name") || "";

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [products, setProducts] = useState<CompanyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [transferring, setTransferring] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmTo, setConfirmTo] = useState<CompanyRecord | null>(null);

  const source = companies.find((company) => company._id === sourceId);
  const sourceName = named || (source ? companyLabel(source) : "Company");
  const destinations = companies.filter((company) => company._id !== sourceId);

  const load = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    setProducts([]);
    setSelected(new Set());
    setVisibleCount(PAGE_SIZE);
    try {
      const list = await getCompanies();
      setCompanies(list);
      await getAllCompanyProducts(sourceId, (soFar, count) => {
        setProducts(soFar);
        setLoading(false);
        setLoadingMore(soFar.length < count);
      });
      setLoadingMore(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const tag = query.trim().toLowerCase();
    if (!tag) return products;
    return products.filter((product) => {
      const name = (product.itemName || "").toLowerCase();
      const ref = (product.itemRef || "").toLowerCase();
      return name.includes(tag) || ref.includes(tag);
    });
  }, [products, query]);

  const shown = filtered.slice(0, visibleCount);
  const filteredIds = filtered.map((product) => product._id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }

  async function transferTo(destination: CompanyRecord) {
    const ids = products
      .map((product) => product._id)
      .filter((id) => selected.has(id));
    if (ids.length === 0) return;
    setTransferring(true);
    try {
      const moved = await transferProductsToCompany(ids, destination._id);
      toast(
        `${moved} product${moved === 1 ? "" : "s"} transferred to ${companyLabel(destination)}`,
        "success",
      );
      setProducts((current) => current.filter((product) => !selected.has(product._id)));
      setSelected(new Set());
      setPickerOpen(false);
      setConfirmTo(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Transfer failed", "error");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={sourceName}
        subtitle="Select products to move to another company."
        actions={
          <Link
            href="/admin/stock-transfer"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            All companies
          </Link>
        }
      />

      {loading && products.length === 0 ? (
        <LoadingState label="Loading products…" />
      ) : error && products.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 w-full sm:max-w-md">
              <TextField
                label="Search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Item name or ref"
              />
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-600">
                {filtered.length.toLocaleString("en-IN")} product
                {filtered.length === 1 ? "" : "s"}
                {loadingMore ? " · loading more…" : ""}
              </p>
              <SecondaryButton
                type="button"
                disabled={filtered.length === 0}
                onClick={toggleAllFiltered}
              >
                {allFilteredSelected ? "Deselect all" : "Select all"}
              </SecondaryButton>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No products found for this company." />
          ) : (
            <div className="space-y-2 pb-24">
              {shown.map((product) => {
                const checked = selected.has(product._id);
                return (
                  <label
                    key={product._id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 ${
                      checked ? "border-brand" : "border-line"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(product._id)}
                      className="h-4 w-4 accent-brand"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">
                        {product.itemName || "Untitled"}
                      </span>
                      {product.itemRef ? (
                        <span className="block text-xs text-slate-500">
                          {product.itemRef}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {shown.length < filtered.length ? (
                <div className="pt-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    Show more ({(filtered.length - shown.length).toLocaleString("en-IN")} remaining)
                  </SecondaryButton>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {selected.size > 0 ? (
        <div className="fixed right-4 bottom-4 left-4 z-30 sm:left-auto sm:w-[360px]">
          <PrimaryButton
            type="button"
            className="w-full shadow-sm"
            disabled={transferring}
            onClick={() => setPickerOpen(true)}
          >
            Transfer to · {selected.size}
          </PrimaryButton>
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-sm">
            {confirmTo ? (
              <>
                <h2 className="text-base font-semibold text-ink">Confirm transfer</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Move {selected.size} selected product{selected.size === 1 ? "" : "s"} from{" "}
                  {sourceName} to {companyLabel(confirmTo)}?
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <SecondaryButton
                    type="button"
                    disabled={transferring}
                    onClick={() => setConfirmTo(null)}
                  >
                    Back
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    disabled={transferring}
                    onClick={() => void transferTo(confirmTo)}
                  >
                    {transferring ? "Transferring…" : "Transfer"}
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-ink">Transfer to</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.size} product{selected.size === 1 ? "" : "s"} from {sourceName}
                </p>
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                  {destinations.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No other company available to transfer to.
                    </p>
                  ) : (
                    destinations.map((company) => (
                      <button
                        key={company._id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:bg-[#f7f5f0]"
                        onClick={() => setConfirmTo(company)}
                      >
                        <span>
                          <span className="block font-medium text-ink">
                            {companyLabel(company)}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {(company.productCount ?? 0).toLocaleString("en-IN")} products
                          </span>
                        </span>
                        <span className="text-sm text-slate-400">→</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <SecondaryButton type="button" onClick={() => setPickerOpen(false)}>
                    Cancel
                  </SecondaryButton>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

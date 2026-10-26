"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getCompanies, type CompanyRecord } from "@/lib/api";
import { resolveSalesCompanyByKey } from "@/lib/sales-selected-company";
import {
  baseItemCodeOf,
  isFreshShmpInventory,
  shmpRemoveStoreProfile,
  shmpStoreCatalogue,
  shmpUpsertStoreProfile,
  type ShmpStoreCatalogueRow,
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

type RowState = ShmpStoreCatalogueRow & { draftPrice: string; busy?: boolean };

export default function ShmpStoreCataloguePage() {
  const params = useParams();
  const storeId = String(params?.id || "");
  const { toast } = useToast();
  const [storeName, setStoreName] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [assignedOnly, setAssignedOnly] = useState(false);

  const shmpCompanyId = resolveSalesCompanyByKey("shmp", companies)?.id || "";

  useEffect(() => {
    void getCompanies()
      .then((list) => setCompanies(Array.isArray(list) ? list : []))
      .catch(() => setCompanies([]));
  }, []);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        ownOnly: "1",
        excludeStl: "1",
      };
      if (companyId.trim()) params.companyId = companyId.trim();
      else if (shmpCompanyId) params.companyId = shmpCompanyId;
      if (query.trim()) params.q = query.trim();
      const data = await shmpStoreCatalogue(storeId, params);
      setStoreName(String(data.store?.storeName || "Store"));
      setRows(
        (data.products || []).map((p) => ({
          ...p,
          draftPrice: String(p.storePrice ?? p.sellingPrice ?? 0),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalogue");
    } finally {
      setLoading(false);
    }
  }, [storeId, companyId, query, shmpCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const own = rows.filter((row) => isFreshShmpInventory(row));
    if (!assignedOnly) return own;
    return own.filter((r) => r.assigned);
  }, [rows, assignedOnly]);

  async function assign(row: RowState) {
    const price = Number(row.draftPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast("Enter a valid store price", "info");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.productId === row.productId ? { ...r, busy: true } : r,
      ),
    );
    try {
      await shmpUpsertStoreProfile(row.productId, {
        storeId,
        storePrice: price,
        isDisplayed: true,
      });
      toast("Product assigned", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Assign failed", "error");
      setRows((prev) =>
        prev.map((r) =>
          r.productId === row.productId ? { ...r, busy: false } : r,
        ),
      );
    }
  }

  async function updatePrice(row: RowState) {
    const price = Number(row.draftPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast("Enter a valid store price", "info");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.productId === row.productId ? { ...r, busy: true } : r,
      ),
    );
    try {
      await shmpUpsertStoreProfile(row.productId, {
        storeId,
        storePrice: price,
        isDisplayed: true,
      });
      toast("Price updated", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
      setRows((prev) =>
        prev.map((r) =>
          r.productId === row.productId ? { ...r, busy: false } : r,
        ),
      );
    }
  }

  async function unassign(row: RowState) {
    if (!confirm(`Remove ${row.itemName || row.itemRef} from this store?`)) {
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.productId === row.productId ? { ...r, busy: true } : r,
      ),
    );
    try {
      await shmpRemoveStoreProfile(row.productId, storeId);
      toast("Product removed from store", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remove failed", "error");
      setRows((prev) =>
        prev.map((r) =>
          r.productId === row.productId ? { ...r, busy: false } : r,
        ),
      );
    }
  }

  return (
    <div>
      <PageHeader
        title={storeName ? `${storeName} · Inventory` : "Store inventory"}
        subtitle="Assign SHMP production products to this store. STL inventory is not listed here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shmp/stores"
              className="inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              Back to stores
            </Link>
            <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
              Refresh
            </SecondaryButton>
          </div>
        }
      />

      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <TextField
          label="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Item name or code"
        />
        <TextField
          label="Company ID filter"
          optional
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder="Optional company ObjectId"
        />
        <label className="flex items-end gap-2 pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={assignedOnly}
            onChange={(e) => setAssignedOnly(e.target.checked)}
            className="rounded border-line"
          />
          Assigned only
        </label>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No products found" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Base price</th>
                <th className="px-4 py-3">Store price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.productId} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {row.itemName || "Unnamed"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[row.itemRef, baseItemCodeOf(row)]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {Number(row.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.draftPrice}
                      disabled={row.busy}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.productId === row.productId
                              ? { ...r, draftPrice: e.target.value }
                              : r,
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {row.assigned ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Assigned
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Not assigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.assigned ? (
                        <>
                          <PrimaryButton
                            type="button"
                            disabled={row.busy}
                            onClick={() => void updatePrice(row)}
                          >
                            Save price
                          </PrimaryButton>
                          <SecondaryButton
                            type="button"
                            className="border-red-200 text-red-700"
                            disabled={row.busy}
                            onClick={() => void unassign(row)}
                          >
                            Remove
                          </SecondaryButton>
                        </>
                      ) : (
                        <PrimaryButton
                          type="button"
                          disabled={row.busy}
                          onClick={() => void assign(row)}
                        >
                          Assign
                        </PrimaryButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

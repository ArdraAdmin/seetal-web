"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteStore, getStores } from "@/lib/api";
import type { StoreProfile } from "@/lib/types";
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

export default function StoresPage() {
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStores(p);
      setStores(Array.isArray(data) ? data : []);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Delete this store?")) return;
    try {
      await deleteStore(id);
      toast("Store deleted", "success");
      await load(page);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  const filtered = stores.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const name = String(s.storeName ?? s.name ?? "").toLowerCase();
    const alias = String(s.alias ?? "").toLowerCase();
    const phone = String(s.mobileNumber ?? "").toLowerCase();
    return name.includes(q) || alias.includes(q) || phone.includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Stores"
        subtitle="Review and maintain store records."
        actions={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
            >
              Prev
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={loading || stores.length === 0}
              onClick={() => void load(page + 1)}
            >
              Next
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void load(page)}>
              Refresh
            </PrimaryButton>
          </div>
        }
      />

      <Card className="mb-5">
        <TextField
          label="Search this page"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, alias, or phone"
        />
        <p className="mt-2 text-xs text-slate-500">Page {page}</p>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(page)} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No stores found" />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const title = String(s.storeName ?? s.name ?? "Unnamed store");
            const salesman =
              typeof s.salesman === "object" && s.salesman
                ? s.salesman.name
                : undefined;
            return (
              <Card
                key={s._id}
                className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{title}</p>
                  {s.alias ? (
                    <p className="text-sm text-slate-500">Alias: {s.alias}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-600">
                    {[s.addressLine1, s.addressLine2, s.addressLine3]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {s.mobileNumber || "No phone"}
                    {salesman ? ` · Sales: ${salesman}` : ""}
                  </p>
                </div>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() => void onDelete(s._id)}
                >
                  Delete
                </SecondaryButton>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { getAllSalesStores } from "@/lib/api";
import { clearCatalogCache } from "@/lib/sales-cart";
import { storeLocation, storeMarks, storeMatchesQuery, storeTitle } from "@/lib/sales";
import type { StoreProfile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export default function SalesHomePage() {
  const { user } = useAuth();
  const firstName = (user?.name || "Sales").trim().split(/\s+/)[0];
  const [myStores, setMyStores] = useState<StoreProfile[]>([]);
  const [otherStores, setOtherStores] = useState<StoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const loadStores = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAllSalesStores(user.id);
      setMyStores(data.myStores);
      setOtherStores(data.otherStores);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    clearCatalogCache();
    void loadStores();
  }, [loadStores]);

  function applySearch() {
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery("");
    setAppliedQuery("");
  }

  const visibleMyStores = useMemo(
    () => myStores.filter((store) => storeMatchesQuery(store, appliedQuery)),
    [myStores, appliedQuery],
  );
  const visibleOtherStores = useMemo(
    () => otherStores.filter((store) => storeMatchesQuery(store, appliedQuery)),
    [otherStores, appliedQuery],
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search a store, then open it to add an order.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadStores()} />
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
                <TextField
                  label="Search stores"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, marks, alias, or city"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                />
              </div>
              <PrimaryButton type="button" onClick={applySearch} disabled={loading}>
                Search
              </PrimaryButton>
              {appliedQuery ? (
                <SecondaryButton type="button" onClick={clearSearch}>
                  Clear
                </SecondaryButton>
              ) : null}
            </div>
          </Card>
          {loading ? (
            <LoadingState label="Loading stores…" />
          ) : (
            <div className="space-y-6">
              <StoreSection
                title="My stores"
                count={visibleMyStores.length}
                empty={
                  appliedQuery
                    ? "No assigned stores match this search."
                    : "No stores assigned to you yet."
                }
                stores={visibleMyStores}
              />
              <StoreSection
                title="Other stores"
                count={visibleOtherStores.length}
                empty={
                  appliedQuery
                    ? "No other stores match this search."
                    : "No other stores."
                }
                stores={visibleOtherStores}
              />
              {myStores.length === 0 && otherStores.length === 0 ? (
                <EmptyState
                  title="No stores"
                  description="No stores are available for this account yet."
                />
              ) : appliedQuery &&
                visibleMyStores.length === 0 &&
                visibleOtherStores.length === 0 ? (
                <EmptyState
                  title="No matching stores"
                  description={`Nothing matched “${appliedQuery}”. Try a store name, marks, or city.`}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StoreSection({
  title,
  count,
  empty,
  stores,
}: {
  title: string;
  count: number;
  empty: string;
  stores: StoreProfile[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-700">
          {count}
        </span>
      </div>
      {stores.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {stores.map((store) => {
            const titleText = storeTitle(store);
            const marks = storeMarks(store);
            const location = storeLocation(store);
            const href = `/sales/stores/${store._id}?name=${encodeURIComponent(titleText)}&marks=${encodeURIComponent(marks)}`;
            return (
              <Link
                key={store._id}
                href={href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 hover:bg-[#f7f5f0]"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{titleText}</p>
                  {marks ? (
                    <p className="mt-1 inline-flex rounded-md bg-brand/15 px-2 py-0.5 text-xs font-extrabold text-ink">
                      {marks}
                    </p>
                  ) : null}
                  {location ? (
                    <p className="mt-1 text-xs text-slate-500">{location}</p>
                  ) : null}
                </div>
                <ShoppingCart className="h-5 w-5 text-ink" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

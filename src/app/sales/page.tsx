"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import {
  createSalesStoreCache,
  downloadSalesStores,
  loadSalesStoreSearchPage,
  loadSalesStoreUiPage,
  SALES_STORE_PAGE_SIZE,
} from "@/lib/api";
import { cartCount, onCartChange } from "@/lib/sales-cart";
import {
  loadDownloadedStores,
  saveDownloadedStores,
} from "@/lib/sales-company";
import {
  storeLocation,
  storeMarks,
  storeProductsHref,
  storeSalesmanId,
  storeTitle,
} from "@/lib/sales";
import type { StoreProfile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  RecordPager,
  SecondaryButton,
  TextField,
} from "@/components/ui";

function splitStores(list: StoreProfile[], userId: string) {
  const mine: StoreProfile[] = [];
  const other: StoreProfile[] = [];
  for (const store of list) {
    if (userId && storeSalesmanId(store) === userId) mine.push(store);
    else other.push(store);
  }
  return { mine, other };
}

export default function SalesHomePage() {
  const { user } = useAuth();
  const firstName = (user?.name || "Sales").trim().split(/\s+/)[0];
  const cacheRef = useRef(createSalesStoreCache());
  const loadGen = useRef(0);
  const [myStores, setMyStores] = useState<StoreProfile[]>([]);
  const [otherStores, setOtherStores] = useState<StoreProfile[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const showLists = (list: StoreProfile[], nextPage: number, tag: string) => {
    if (!user?.id) return;
    const { mine, other } = splitStores(list, user.id);
    if (tag) {
      setMyStores([]);
      setOtherStores(list);
    } else {
      setMyStores(mine);
      setOtherStores(other);
    }
    setPage(nextPage);
    setAppliedQuery(tag);
    setHasNext(false);
  };

  const loadStores = useCallback(
    async (nextPage = 1, tag = "") => {
      if (!user?.id) return;
      const gen = ++loadGen.current;
      setLoading(true);
      setError(null);
      try {
        const cached = loadDownloadedStores();
        if (cached.length > 0) {
          const filtered = tag
            ? cached.filter((store) => {
                const hay = [
                  store.storeName,
                  store.name,
                  store.marks,
                  store.city,
                  store.country,
                  store.alias,
                ]
                  .map((value) => String(value || "").toLowerCase())
                  .join(" ");
                return hay.includes(tag.trim().toLowerCase());
              })
            : cached;
          if (gen !== loadGen.current) return;
          showLists(filtered as StoreProfile[], nextPage, tag);
          setDownloaded(true);
          return;
        }
        if (tag) {
          const data = await loadSalesStoreSearchPage(
            tag,
            nextPage,
            cacheRef.current,
          );
          if (gen !== loadGen.current) return;
          setMyStores([]);
          setOtherStores(data.stores);
          setHasNext(data.hasNext);
        } else {
          const data = await loadSalesStoreUiPage(
            user.id,
            nextPage,
            cacheRef.current,
          );
          if (gen !== loadGen.current) return;
          setMyStores(data.myStores);
          setOtherStores(data.otherStores);
          setHasNext(data.hasNext);
        }
        setPage(nextPage);
        setAppliedQuery(tag);
      } catch (e) {
        if (gen !== loadGen.current) return;
        setError(e instanceof Error ? e.message : "Failed to load stores");
      } finally {
        if (gen === loadGen.current) setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    cacheRef.current = createSalesStoreCache();
    void loadStores(1, "");
  }, [loadStores]);

  async function onDownloadStores() {
    if (!user?.id) return;
    const gen = ++loadGen.current;
    setDownloading(true);
    setError(null);
    try {
      const stores = await downloadSalesStores(user.id);
      const list = Array.isArray(stores) ? stores : [];
      saveDownloadedStores(list);
      if (gen !== loadGen.current) return;
      showLists(list, 1, "");
      setQuery("");
      setDownloaded(true);
      setLoading(false);
    } catch (e) {
      if (gen !== loadGen.current) return;
      setError(e instanceof Error ? e.message : "Failed to download stores");
    } finally {
      setDownloading(false);
    }
  }

  function applySearch() {
    void loadStores(1, query.trim());
  }

  function clearSearch() {
    setQuery("");
    void loadStores(1, "");
  }

  const pageCount = myStores.length + otherStores.length;
  const rangeStart = pageCount === 0 ? 0 : (page - 1) * SALES_STORE_PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * SALES_STORE_PAGE_SIZE + pageCount;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search a store, then open it to add an order.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadStores(page, appliedQuery)} />
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
              <SecondaryButton
                type="button"
                onClick={() => void onDownloadStores()}
                disabled={downloading}
              >
                {downloading ? "Downloading…" : "Download stores"}
              </SecondaryButton>
            </div>
          </Card>
          {loading ? (
            <LoadingState label="Loading stores…" />
          ) : pageCount === 0 ? (
            <EmptyState
              title={appliedQuery ? "No matching stores" : "No stores"}
              description={
                appliedQuery
                  ? `Nothing matched “${appliedQuery}”. Try a store name, marks, or city.`
                  : "No stores are available for this account yet."
              }
            />
          ) : (
            <div className="space-y-6">
              {appliedQuery ? (
                <StoreSection
                  title="Search results"
                  count={otherStores.length}
                  empty={`Nothing matched “${appliedQuery}”.`}
                  stores={otherStores}
                />
              ) : (
                <>
                  {myStores.length > 0 || page === 1 ? (
                    <StoreSection
                      title="My stores"
                      count={myStores.length}
                      empty="No stores assigned to you yet."
                      stores={myStores}
                    />
                  ) : null}
                  <StoreSection
                    title="Other stores"
                    count={otherStores.length}
                    empty="No other stores on this page."
                    stores={otherStores}
                  />
                </>
              )}
              {downloaded ? null : (
                <RecordPager
                  page={page}
                  hasNext={hasNext}
                  loading={loading}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  pageSize={SALES_STORE_PAGE_SIZE}
                  onPage={(next) => void loadStores(next, appliedQuery)}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StoreCartIcon({ storeId }: { storeId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(cartCount(storeId));
    refresh();
    return onCartChange(storeId, refresh);
  }, [storeId]);

  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-ink">
      <ShoppingCart className="h-5 w-5" aria-hidden />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          ) : null}
      <span className="sr-only">
        {count > 0 ? `${count} items in cart` : "Cart empty"}
      </span>
    </span>
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
            return (
              <Link
                key={store._id}
                href={storeProductsHref(store)}
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
                <StoreCartIcon storeId={store._id} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

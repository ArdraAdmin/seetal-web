"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Package, ShoppingCart, Store } from "lucide-react";
import { downloadSalesCatalog, getAllSalesStores } from "@/lib/api";
import { saveCatalog } from "@/lib/sales-cart";
import { storeLocation, storeMarks, storeTitle } from "@/lib/sales";
import type { StoreProfile } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ui";

export default function SalesHomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const firstName = (user?.name || "Sales").trim().split(/\s+/)[0];
  const [myStores, setMyStores] = useState<StoreProfile[]>([]);
  const [otherStores, setOtherStores] = useState<StoreProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInventory, setDownloadingInventory] = useState(false);
  const [downloadingStores, setDownloadingStores] = useState(false);
  const [catalogCount, setCatalogCount] = useState<number | null>(null);

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
    void loadStores();
  }, [loadStores]);

  async function onDownloadInventory() {
    if (!user?.id) return;
    setDownloadingInventory(true);
    try {
      const products = await downloadSalesCatalog(user.id);
      saveCatalog(products);
      setCatalogCount(products.length);
      toast(
        products.length
          ? `Inventory ready · ${products.length} products`
          : "No products available for this account",
        products.length ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not download inventory", "error");
    } finally {
      setDownloadingInventory(false);
    }
  }

  async function onDownloadStores() {
    setDownloadingStores(true);
    try {
      await loadStores();
      toast("Store list updated", "success");
    } finally {
      setDownloadingStores(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sync your catalogue, then pick a store to start an order.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void onDownloadInventory()}
          disabled={downloadingInventory}
          className="rounded-2xl border border-line bg-white p-4 text-left hover:bg-[#f7f5f0] disabled:opacity-60"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-ink">
            <Package className="h-5 w-5" />
          </span>
          <p className="mt-3 font-semibold text-slate-900">Inventory</p>
          <p className="text-sm text-slate-500">
            {downloadingInventory
              ? "Downloading products…"
              : catalogCount != null
                ? `${catalogCount} products ready`
                : "Download products"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => void onDownloadStores()}
          disabled={downloadingStores || loading}
          className="rounded-2xl border border-line bg-white p-4 text-left hover:bg-[#f7f5f0] disabled:opacity-60"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-ink">
            <Store className="h-5 w-5" />
          </span>
          <p className="mt-3 font-semibold text-slate-900">Stores</p>
          <p className="text-sm text-slate-500">
            {downloadingStores ? "Downloading your list…" : "Download your list"}
          </p>
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading stores…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadStores()} />
      ) : (
        <div className="space-y-6">
          <StoreSection
            title="My stores"
            count={myStores.length}
            empty="No stores assigned to you yet."
            stores={myStores}
          />
          <StoreSection
            title="Other stores"
            count={otherStores.length}
            empty="No other stores."
            stores={otherStores}
          />
          {myStores.length === 0 && otherStores.length === 0 ? (
            <EmptyState
              title="No stores"
              description="Download your store list to start taking orders."
            />
          ) : null}
        </div>
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { getStoreProducts } from "@/lib/api";
import {
  cartCount,
  cartLineFromProduct,
  loadCart,
  loadCatalog,
  onCartChange,
  upsertCartLine,
} from "@/lib/sales-cart";
import {
  productCartonStock,
  productRatio,
  productUnit,
  productUnitPrice,
  productUnitStock,
  salesMoney,
} from "@/lib/sales";
import type { Product } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ErrorState, LoadingState, PrimaryButton } from "@/components/ui";

export default function SalesStoreProductsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = params.id;
  const storeName = searchParams.get("name") || "Store";
  const marks = searchParams.get("marks") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingCatalog, setUsingCatalog] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(cartCount(storeId));
    return onCartChange(storeId, () => setCount(cartCount(storeId)));
  }, [storeId]);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (!user?.id || !storeId) return;
      if (nextPage === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const catalog = nextPage === 1 ? loadCatalog() : [];
        if (nextPage === 1 && catalog.length > 0) {
          setUsingCatalog(true);
          setProducts(catalog);
          setHasMore(false);
          try {
            const priced = await getStoreProducts(storeId, user.id, 1, false);
            if (priced.length) {
              const prices = new Map(
                priced.map((item) => [item._id, productUnitPrice(item)]),
              );
              setProducts(
                catalog.map((item) =>
                  prices.has(item._id)
                    ? { ...item, sellingPrice: prices.get(item._id) }
                    : item,
                ),
              );
            }
          } catch {
            /* catalog is enough to start an order */
          }
        } else {
          const list = await getStoreProducts(storeId, user.id, nextPage, false);
          setUsingCatalog(false);
          setProducts((prev) => (append ? [...prev, ...list] : list));
          setHasMore(list.length >= 50);
          setPage(nextPage);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [storeId, user?.id],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Link href="/sales" className="text-sm font-medium text-ink hover:underline">
            ← Stores
          </Link>
          <h1 className="mt-2 text-xl font-bold text-slate-900">{storeName}</h1>
          {marks ? (
            <p className="mt-1 inline-flex rounded-md bg-brand/15 px-2 py-0.5 text-xs font-extrabold text-ink">
              {marks}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-500">Select product</p>
        </div>
        <Link
          href={`/sales/stores/${storeId}/cart?name=${encodeURIComponent(storeName)}&marks=${encodeURIComponent(marks)}`}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand text-black"
          aria-label="Open cart"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          ) : null}
        </Link>
      </div>

      {loading ? (
        <LoadingState label="Loading products…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(1)} />
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-500">
          {usingCatalog
            ? "Inventory is empty. Download products from the Sales home screen."
            : "No products for this store."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                storeId={storeId}
                onAdded={() =>
                  toast(`${product.itemName || "Product"} added to cart`, "success")
                }
                onError={(message) => toast(message, "error")}
              />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <PrimaryButton
                type="button"
                disabled={loadingMore}
                onClick={() => void load(page + 1, true)}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </PrimaryButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProductCard({
  product,
  storeId,
  onAdded,
  onError,
}: {
  product: Product;
  storeId: string;
  onAdded: () => void;
  onError: (message: string) => void;
}) {
  const unit = productUnit(product);
  const [qty, setQty] = useState(0);
  const [unitReq, setUnitReq] = useState(unit);
  const price = productUnitPrice(product);
  const ratio = productRatio(product);
  const cartons = productCartonStock(product);
  const pieces = productUnitStock(product);

  useEffect(() => {
    const existing = loadCart(storeId).find((line) => line.productId === product._id);
    if (existing) {
      setQty(existing.quantityReq);
      setUnitReq(existing.unitReq);
    }
  }, [product._id, storeId]);

  function add() {
    const line = cartLineFromProduct(product, qty, unitReq);
    if (!line) {
      onError("This product is missing a category and cannot be ordered");
      return;
    }
    if (qty <= 0) {
      onError("Enter a quantity first");
      return;
    }
    upsertCartLine(storeId, line);
    onAdded();
  }

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white p-3">
      <p className="min-h-10 text-sm font-bold leading-snug text-slate-900">
        {product.itemName || product.itemRef || "Product"}
      </p>
      <p className="mt-1 text-[15px] font-extrabold text-ink">{salesMoney(price)}</p>
      <p className="mt-1 text-xs text-slate-500">
        {ratio ? `${ratio} ${unit}/CTN` : unit}
        <span className="ml-2 font-semibold text-red-500">CTN {cartons}</span>
        <span className="ml-2 font-semibold text-emerald-600">
          {unit} {pieces}
        </span>
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select
          value={unitReq}
          onChange={(e) => setUnitReq(e.target.value)}
          className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
        >
          <option value={unit}>{unit}</option>
          <option value="CARTONS">CTN</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-line text-lg leading-none"
            onClick={() => setQty((value) => Math.max(0, value - 1))}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold">{qty}</span>
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-line text-lg leading-none"
            onClick={() => setQty((value) => value + 1)}
          >
            +
          </button>
        </div>
      </div>
      <PrimaryButton type="button" className="mt-3 w-full" onClick={add}>
        Add to cart
      </PrimaryButton>
    </article>
  );
}

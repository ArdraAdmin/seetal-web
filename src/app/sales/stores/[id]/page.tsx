"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Search, ShoppingCart } from "lucide-react";
import {
  createSalesProductCache,
  loadSalesInventoryUiPage,
  SALES_INVENTORY_PAGE_SIZE,
} from "@/lib/api";
import {
  cartCount,
  cartLineFromProduct,
  loadCart,
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
import {
  Card,
  ErrorState,
  LoadingState,
  PrimaryButton,
  RecordPager,
  SecondaryButton,
} from "@/components/ui";

export default function SalesStoreProductsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = params.id;
  const storeName = searchParams.get("name") || "Store";
  const marks = searchParams.get("marks") || "";

  const cacheRef = useRef(createSalesProductCache());
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  useEffect(() => {
    setCount(cartCount(storeId));
    return onCartChange(storeId, () => setCount(cartCount(storeId)));
  }, [storeId]);

  const load = useCallback(
    async (nextPage = 1, searchTag = "") => {
      if (!user?.id || !storeId) return;
      const tag = searchTag.trim();
      setLoading(true);
      setError(null);
      try {
        const data = await loadSalesInventoryUiPage(
          storeId,
          user.id,
          nextPage,
          tag,
          cacheRef.current,
        );
        setProducts(data.products);
        setHasNext(data.hasNext);
        setPage(nextPage);
        setAppliedQuery(tag);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    },
    [storeId, user?.id],
  );

  useEffect(() => {
    cacheRef.current = createSalesProductCache();
    void load(1, "");
  }, [load]);

  function applySearch() {
    void load(1, query.trim());
  }

  function clearSearch() {
    setQuery("");
    void load(1, "");
  }

  const rangeStart =
    products.length === 0 ? 0 : (page - 1) * SALES_INVENTORY_PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * SALES_INVENTORY_PAGE_SIZE + products.length;

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

      <Card className="mb-5">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applySearch();
          }}
        >
          <div className="relative min-w-0 w-full flex-1 sm:min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this store's inventory"
              aria-label="Search this store's inventory"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3 text-base text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm"
            />
          </div>
          <PrimaryButton type="submit" disabled={loading}>
            Search
          </PrimaryButton>
          {appliedQuery ? (
            <SecondaryButton type="button" onClick={clearSearch} disabled={loading}>
              Clear
            </SecondaryButton>
          ) : null}
        </form>
        {appliedQuery && !loading ? (
          <p className="mt-2 text-xs text-slate-500">
            {products.length} item{products.length === 1 ? "" : "s"} matching “{appliedQuery}”
          </p>
        ) : null}
      </Card>

      {loading ? (
        <LoadingState label="Loading products…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load(page, appliedQuery)} />
      ) : products.length === 0 ? (
        <p className="text-sm text-slate-500">
          {appliedQuery
            ? `No items matched “${appliedQuery}”.`
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
          <RecordPager
            page={page}
            hasNext={hasNext}
            loading={loading}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            pageSize={SALES_INVENTORY_PAGE_SIZE}
            onPage={(next) => void load(next, appliedQuery)}
          />
        </>
      )}
    </div>
  );
}

function parseQtyInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
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
  const [qtyInput, setQtyInput] = useState("0");
  const [unitReq, setUnitReq] = useState(unit);
  const [added, setAdded] = useState(false);
  const price = productUnitPrice(product);
  const ratio = productRatio(product);
  const cartons = productCartonStock(product);
  const pieces = productUnitStock(product);

  function setQuantity(next: number) {
    const qtyValue = Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
    setQty(qtyValue);
    setQtyInput(String(qtyValue));
  }

  useEffect(() => {
    function syncFromCart() {
      const existing = loadCart(storeId).find(
        (line) => line.productId === product._id,
      );
      if (existing) {
        setQuantity(existing.quantityReq);
        setUnitReq(existing.unitReq);
        setAdded(true);
      } else {
        setAdded(false);
      }
    }
    syncFromCart();
    return onCartChange(storeId, syncFromCart);
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
    setAdded(true);
    onAdded();
  }

  return (
    <article className="flex flex-col rounded-2xl border border-line bg-white p-3">
      {product.itemRef ? (
        <p className="text-xs font-bold tracking-wide text-ink">{product.itemRef}</p>
      ) : null}
      <p className="mt-0.5 min-h-10 text-sm font-bold leading-snug text-slate-900">
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
            aria-label="Decrease quantity"
            onClick={() => setQuantity(qty - 1)}
          >
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Quantity"
            value={qtyInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setQtyInput(raw);
              setQty(parseQtyInput(raw));
            }}
            onBlur={() => setQtyInput(String(qty))}
            className="h-8 w-16 rounded-lg border border-line bg-white text-center text-sm font-semibold text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-line text-lg leading-none"
            aria-label="Increase quantity"
            onClick={() => setQuantity(qty + 1)}
          >
            +
          </button>
        </div>
      </div>
      {added ? (
        <button
          type="button"
          className="mt-3 min-h-10 w-full rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          onClick={add}
        >
          Added
        </button>
      ) : (
        <PrimaryButton type="button" className="mt-3 w-full" onClick={add}>
          Add to cart
        </PrimaryButton>
      )}
    </article>
  );
}

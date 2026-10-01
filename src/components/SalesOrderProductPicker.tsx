"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSalesProductCache,
  loadSalesInventoryUiPage,
  localSalesInventoryPage,
  SALES_INVENTORY_PAGE_SIZE,
  syncSalesInventory,
} from "@/lib/api";
import { onSalesAccessChange } from "@/lib/sales-company";
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
import {
  Card,
  LoadingState,
  PrimaryButton,
  RecordPager,
  SecondaryButton,
} from "@/components/ui";

export function SalesOrderProductPicker({
  storeId,
  tempStore,
  onAdd,
}: {
  storeId: string;
  tempStore: boolean;
  onAdd: (product: Product, quantity: number, unitReq: string) => string | null;
}) {
  const { user } = useAuth();
  const cacheRef = useRef(createSalesProductCache());
  const loadGen = useRef(0);
  const appliedRef = useRef("");
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage = 1, searchTag = "") => {
      if (!user?.id || !storeId) return;
      const gen = ++loadGen.current;
      const tag = searchTag.trim();
      const local = localSalesInventoryPage(nextPage, tag);
      if (local) {
        if (gen !== loadGen.current) return;
        setProducts(local.products);
        setHasNext(local.hasNext);
        setPage(nextPage);
        setAppliedQuery(tag);
        appliedRef.current = tag;
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      void syncSalesInventory(user.id);
      try {
        const data = await loadSalesInventoryUiPage(
          storeId,
          user.id,
          nextPage,
          tag,
          cacheRef.current,
          tempStore,
        );
        if (gen !== loadGen.current) return;
        setProducts(data.products);
        setHasNext(data.hasNext);
        setPage(nextPage);
        setAppliedQuery(tag);
        appliedRef.current = tag;
      } catch (e) {
        if (gen !== loadGen.current) return;
        setError(e instanceof Error ? e.message : "Failed to load products");
      } finally {
        if (gen === loadGen.current) setLoading(false);
      }
    },
    [storeId, tempStore, user?.id],
  );

  useEffect(() => {
    cacheRef.current = createSalesProductCache();
    void load(1, "");
  }, [load]);

  useEffect(() => {
    return onSalesAccessChange(() => {
      cacheRef.current = createSalesProductCache();
      void load(1, appliedRef.current);
    });
  }, [load]);

  return (
    <Card>
      <h2 className="text-sm font-bold text-slate-800">Add products</h2>
      <p className="mt-1 text-xs text-slate-500">
        Search by name, item code, or barcode. Existing order lines stay as they
        are.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(1, query.trim());
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, item code, or barcode"
          className="h-11 min-w-0 w-full flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand sm:min-w-[220px]"
        />
        <PrimaryButton type="submit" disabled={loading}>
          Search
        </PrimaryButton>
        {appliedQuery ? (
          <SecondaryButton
            type="button"
            disabled={loading}
            onClick={() => {
              setQuery("");
              void load(1, "");
            }}
          >
            Clear
          </SecondaryButton>
        ) : null}
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <div className="mt-3">
          <LoadingState label="Loading products…" />
        </div>
      ) : products.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {appliedQuery
            ? `No items matched “${appliedQuery}”.`
            : "No products available for this account."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {products.map((product) => (
            <AddProductRow
              key={product._id}
              product={product}
              onAdd={onAdd}
            />
          ))}
          <RecordPager
            page={page}
            hasNext={hasNext}
            loading={loading}
            rangeStart={
              products.length === 0
                ? 0
                : (page - 1) * SALES_INVENTORY_PAGE_SIZE + 1
            }
            rangeEnd={(page - 1) * SALES_INVENTORY_PAGE_SIZE + products.length}
            pageSize={SALES_INVENTORY_PAGE_SIZE}
            onPage={(next) => void load(next, appliedQuery)}
          />
        </div>
      )}
    </Card>
  );
}

function AddProductRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product, quantity: number, unitReq: string) => string | null;
}) {
  const unit = productUnit(product);
  const [qty, setQty] = useState(1);
  const [unitReq, setUnitReq] = useState(unit);
  const [message, setMessage] = useState<string | null>(null);
  const price = productUnitPrice(product);

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs font-bold tracking-wide text-ink">{product.itemRef}</p>
      <p className="text-sm font-semibold text-slate-900">
        {product.itemName || product.itemRef || "Product"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {salesMoney(price)} · CTN {productCartonStock(product)} · {unit}{" "}
        {productUnitStock(product)}
        {productRatio(product) ? ` · ${productRatio(product)} ${unit}/CTN` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={unitReq}
          onChange={(e) => setUnitReq(e.target.value)}
          className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
        >
          <option value={unit}>{unit}</option>
          <option value="CARTONS">CTN</option>
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={String(qty)}
          onChange={(e) =>
            setQty(Math.max(0, Number.parseInt(e.target.value.replace(/[^\d]/g, ""), 10) || 0))
          }
          className="h-9 w-16 rounded-lg border border-line text-center text-sm"
        />
        <PrimaryButton
          type="button"
          onClick={() => {
            const error = onAdd(product, qty, unitReq);
            setMessage(error || "Added");
          }}
        >
          Add
        </PrimaryButton>
        {message ? (
          <span className={message === "Added" ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}

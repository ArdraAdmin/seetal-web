"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { getWarehouseDeliveredOrder } from "@/lib/api";
import type { WarehouseCheckLine, WarehouseCheckOrder } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import {
  ErrorState,
  LoadingState,
} from "@/components/ui";
import {
  assigneeLabel,
  cartonLabel,
  formatOrderDate,
  invoiceLabel,
  storeMarks,
  storeTitle,
  warehouseBasePath,
  warehouseDeliveredListHref,
  warehouseLineName,
  warehouseLineProductId,
  warehouseLineRatio,
  warehouseLineRef,
  warehouseLineUnit,
} from "@/lib/warehouse";

function shippedLabel(line: WarehouseCheckLine) {
  const qty = Number(line.quantityAv);
  const amount = Number.isFinite(qty) ? qty : 0;
  const unit =
    line.unitAv === "CARTONS"
      ? "CTN"
      : line.unitAv || line.unitReq || warehouseLineUnit(line);
  return `${amount} ${unit}`;
}

export function WarehouseDeliveredView() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { user } = useAuth();
  const base = warehouseBasePath(pathname);
  const listHref = warehouseDeliveredListHref(base);

  const [order, setOrder] = useState<WarehouseCheckOrder | null>(null);
  const [lines, setLines] = useState<WarehouseCheckLine[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseDeliveredOrder(params.id, user.id);
      if (gen !== loadGen.current) return;
      setOrder(data);
      setLines(Array.isArray(data.productDetails) ? data.productDetails : []);
    } catch (e) {
      if (gen !== loadGen.current) return;
      setError(e instanceof Error ? e.message : "Failed to load order");
      setOrder(null);
      setLines([]);
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => {
      const name = warehouseLineName(line).toLowerCase();
      const ref = warehouseLineRef(line).toLowerCase();
      return name.includes(q) || ref.includes(q);
    });
  }, [lines, query]);

  const pkg = order?.totalPkg;

  return (
    <div className="flex min-h-full flex-col bg-[#f3f0ea]">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-brand px-3 py-3 text-ink shadow-sm">
        <Link
          href={listHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"
          aria-label="Back to delivered orders"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Delivered order</p>
          <p className="truncate text-xs font-medium opacity-80">
            View only · items and cartons
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
            strokeWidth={2}
          />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pb-8 pt-4">
        {loading ? (
          <LoadingState label="Loading order…" />
        ) : error || !order ? (
          <ErrorState
            message={error || "Order not found"}
            onRetry={() => void load()}
          />
        ) : (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[13px] font-medium text-slate-500">
                {invoiceLabel(order) || "Order"}
              </p>
              <p className="mt-1 text-[15px] font-bold text-slate-900">
                {storeTitle(order)}
              </p>
              <p className="mt-1 text-[13px] font-medium text-slate-600">
                {formatOrderDate(order.date)}
              </p>
              {storeMarks(order) ? (
                <p className="mt-3 inline-flex rounded-lg bg-brand/15 px-2.5 py-1 text-[13px] font-extrabold text-ink">
                  Marks: {storeMarks(order)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <p className="text-sm font-bold text-slate-900">Products</p>
                <p className="text-[13px] font-medium text-slate-500">
                  Assignee · {assigneeLabel(order)}
                  {pkg != null ? ` · ${pkg} PKGS` : ""}
                </p>
              </div>
            </section>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or item code"
                className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>

            {visible.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No products</p>
            ) : (
              <div className="mt-4 space-y-3">
                {visible.map((line) => {
                  const productId = warehouseLineProductId(line);
                  const unit = warehouseLineUnit(line);
                  const ratio = warehouseLineRatio(line);
                  const carton = cartonLabel(line);
                  const key =
                    productId ||
                    warehouseLineRef(line) ||
                    warehouseLineName(line);
                  return (
                    <article
                      key={key}
                      className="rounded-2xl bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold leading-snug text-black">
                        {warehouseLineName(line)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {ratio
                          ? `${ratio} ${unit}/CTN`
                          : `${line.quantityReq ?? 0} ${line.unitReq || ""}`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {warehouseLineRef(line) ? (
                          <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[13px] font-extrabold text-ink">
                            {warehouseLineRef(line)}
                          </span>
                        ) : null}
                        <span className="text-sm font-bold text-black">
                          {shippedLabel(line)}
                        </span>
                      </div>
                      {carton ? (
                        <p className="mt-1.5 text-[13px] font-semibold text-ink">
                          {carton}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import {
  checkAllWarehouseLines,
  confirmWarehouseCheck,
  generateWarehouseInvoice,
  downloadSalesStores,
  getWarehouseCheckOrder,
  markWarehouseLineMissing,
  saveWarehouseCheck,
  toggleWarehouseLineCheck,
  updateWarehouseDeliveryDate,
  updateWarehouseOrderStore,
} from "@/lib/api";
import type { StoreProfile, WarehouseCheckLine, WarehouseCheckOrder } from "@/lib/types";
import { storeDisplayName, uniqueStores } from "@/lib/stores";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ErrorState, LoadingState, PrimaryButton } from "@/components/ui";
import {
  CHECK_LABELS,
  assigneeLabel,
  cartonLabel,
  checkFlagForStep,
  formatOrderDate,
  invoiceLabel,
  lineIsChecked,
  orderDateInputValue,
  parseCheckStep,
  storeId,
  storeMarks,
  storeTitle,
  warehouseBasePath,
  warehouseLineName,
  warehouseLineProductId,
  warehouseLineRatio,
  warehouseLineRef,
  warehouseLineUnit,
} from "@/lib/warehouse";

export function WarehouseCheckView() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const step = parseCheckStep(searchParams.get("step"));
  const base = warehouseBasePath(pathname);

  const [order, setOrder] = useState<WarehouseCheckOrder | null>(null);
  const [lines, setLines] = useState<WarehouseCheckLine[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeQuery, setStoreQuery] = useState("");
  const [storeOptions, setStoreOptions] = useState<StoreProfile[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseCheckOrder(params.id, user.id, step);
      setOrder(data);
      setLines(Array.isArray(data.productDetails) ? data.productDetails : []);
      setDeliveryDate(orderDateInputValue(data.date));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id, step]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setStoreOpen(false);
    setStoreQuery("");
  }, [step, params.id]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = lines.filter((line) =>
      step === 3 ? Number(line.quantityAv) !== 0 : true,
    );
    if (!q) return list;
    return list.filter((line) => {
      const name = warehouseLineName(line).toLowerCase();
      const ref = warehouseLineRef(line).toLowerCase();
      return name.includes(q) || ref.includes(q);
    });
  }, [lines, query, step]);

  function updateLine(productId: string, patch: Partial<WarehouseCheckLine>) {
    setLines((prev) =>
      prev.map((line) =>
        warehouseLineProductId(line) === productId ? { ...line, ...patch } : line,
      ),
    );
  }

  function markStepComplete() {
    const flag = checkFlagForStep(step);
    setOrder((prev) => (prev ? { ...prev, [flag]: true } : prev));
  }

  async function onSave() {
    if (!user?.id || !order) return;
    setSaving(true);
    try {
      await saveWarehouseCheck(order._id, user.id, lines);
      toast("Products updated", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onConfirm() {
    if (!user?.id || !order) return;
    setConfirming(true);
    try {
      await confirmWarehouseCheck(step, order._id, user.id, lines);
      markStepComplete();
      toast(`${CHECK_LABELS[step]} has been confirmed`, "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Confirm failed", "error");
    } finally {
      setConfirming(false);
    }
  }

  const storeMatches = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return storeOptions
      .filter((store) => {
        const blob = [store.storeName, store.name, store.marks, store.alias, store.city]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 8);
  }, [storeOptions, storeQuery]);

  async function openStorePicker() {
    const next = !storeOpen;
    setStoreOpen(next);
    if (!next || storeOptions.length || storesLoading) return;
    setStoresLoading(true);
    try {
      setStoreOptions(uniqueStores(await downloadSalesStores()));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load stores", "error");
    } finally {
      setStoresLoading(false);
    }
  }

  async function onChangeStore(store: StoreProfile) {
    if (!user?.id || !order || !store._id || store._id === storeId(order)) return;
    setSavingStoreId(store._id);
    try {
      const result = await updateWarehouseOrderStore(order._id, user.id, store._id);
      setOrder((prev) =>
        prev
          ? { ...prev, isTempStore: result.isTempStore, store: result.store }
          : prev,
      );
      toast(`Store changed to ${storeDisplayName(result.store)}`, "success");
      setStoreOpen(false);
      setStoreQuery("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change store", "error");
    } finally {
      setSavingStoreId(null);
    }
  }

  async function onSaveDate() {
    if (!user?.id || !order) return;
    const next = deliveryDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) {
      toast("Choose a delivery date", "info");
      return;
    }
    if (next === orderDateInputValue(order.date)) {
      toast("Delivery date is unchanged", "info");
      return;
    }
    setSavingDate(true);
    try {
      await updateWarehouseDeliveryDate(order._id, user.id, next);
      setOrder((prev) =>
        prev ? { ...prev, date: `${next}T00:00:00.000Z` } : prev,
      );
      toast("Delivery date updated", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update date", "error");
    } finally {
      setSavingDate(false);
    }
  }

  async function onInvoice() {
    if (!user?.id || !order) return;
    if (order.invoiceGenerated) {
      toast("Invoice already generated", "info");
      return;
    }
    setInvoicing(true);
    try {
      await generateWarehouseInvoice(order._id, user.id);
      setOrder((prev) => (prev ? { ...prev, invoiceGenerated: true } : prev));
      toast("Invoice generated and emailed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not generate invoice", "error");
    } finally {
      setInvoicing(false);
    }
  }

  async function onToggle(line: WarehouseCheckLine, next: boolean) {
    if (!user?.id || !order) return;
    const productId = warehouseLineProductId(line);
    if (!productId) return;
    setBusyId(productId);
    try {
      await toggleWarehouseLineCheck(step, order._id, user.id, productId, next);
      const flag = checkFlagForStep(step);
      updateLine(productId, { [flag]: next });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update check", "error");
    } finally {
      setBusyId(null);
    }
  }

  function onZero(line: WarehouseCheckLine) {
    const productId = warehouseLineProductId(line);
    if (!productId) return;
    updateLine(productId, { quantityAv: 0 });
  }

  async function onMissing(line: WarehouseCheckLine) {
    if (!user?.id || !order) return;
    const productId = warehouseLineProductId(line);
    if (!productId) return;
    setBusyId(productId);
    try {
      await markWarehouseLineMissing(order._id, user.id, productId);
      toast("Product marked missing", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove product", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function onCheckAll() {
    if (!user?.id || !order) return;
    setSaving(true);
    try {
      await checkAllWarehouseLines(order._id, user.id, step, true);
      toast("Products updated", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Select all failed", "error");
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (!order) return;
    if (step === 1 && !order.firstCheck) {
      toast("Please complete first check", "info");
      return;
    }
    if (step === 2 && !order.doubleCheck) {
      toast("Please complete double check", "info");
      return;
    }
    router.push(`${base}/${order._id}?step=${step + 1}`);
  }

  const nextLabel = step === 1 ? "Double Check" : "Loading Check";
  const stockInfo = (line: WarehouseCheckLine) => {
    if (typeof line.product !== "object" || !line.product?.stockCheck) return "";
    const cartons = line.product.inQty?.amountInCartons;
    const units = line.product.inQty?.amountInUnits;
    if (cartons == null && units == null) return "";
    return `Carton: ${cartons ?? 0}  ·  Units: ${units ?? 0}`;
  };

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 rounded-2xl bg-brand px-3 py-3 text-black">
        <Link
          href={base}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {CHECK_LABELS[step]}
        </h1>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
        </button>
        {step === 1 ? (
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void onSave()}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "SAVE"}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void onCheckAll()}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "Updating…" : "Select all"}
          </button>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col pt-4">
        {loading ? (
          <LoadingState label="Loading order…" />
        ) : error || !order ? (
          <ErrorState message={error || "Order not found"} onRetry={() => void load()} />
        ) : (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-[13px] font-medium text-slate-500">
                {invoiceLabel(order) || "Order"}
              </p>
              <p className="mt-1 text-[15px] font-bold text-slate-900">
                {storeTitle(order)}
              </p>
              {step === 1 || step === 2 ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void openStorePicker()}
                    className="text-sm font-semibold text-ink underline decoration-brand underline-offset-2"
                  >
                    Change store
                  </button>
                  {storeOpen ? (
                    <div className="mt-2 rounded-xl border border-line bg-[#f7f5f0] p-3">
                      <label className="block space-y-1.5">
                        <span className="text-[13px] font-medium text-slate-700">
                          Store
                        </span>
                        <input
                          value={storeQuery}
                          onChange={(e) => setStoreQuery(e.target.value)}
                          placeholder="Search by name or marks"
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </label>
                      {storesLoading ? (
                        <p className="mt-2 text-sm text-slate-500">Loading stores…</p>
                      ) : storeQuery.trim().length < 2 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Type at least 2 letters
                        </p>
                      ) : storeMatches.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No stores match</p>
                      ) : (
                        <div className="mt-2 space-y-1">
                          {storeMatches.map((store) => {
                            const current = store._id === storeId(order);
                            const busy = savingStoreId === store._id;
                            return (
                              <button
                                key={store._id}
                                type="button"
                                disabled={current || Boolean(savingStoreId)}
                                onClick={() => void onChangeStore(store)}
                                className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm hover:bg-brand/10 disabled:cursor-default disabled:opacity-70"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-slate-900">
                                    {storeDisplayName(store)}
                                  </span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {store.marks ? `Marks: ${store.marks}` : "No marks"}
                                    {store.city ? ` · ${store.city}` : ""}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs font-semibold text-slate-500">
                                  {current ? "Current" : busy ? "Saving…" : "Select"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {step === 1 || step === 2 ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-[11rem] flex-1 space-y-1.5">
                    <span className="text-[13px] font-medium text-slate-700">
                      Delivery date
                    </span>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      savingDate ||
                      loading ||
                      !deliveryDate ||
                      deliveryDate === orderDateInputValue(order.date)
                    }
                    onClick={() => void onSaveDate()}
                    className="min-h-10 rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingDate ? "Saving…" : "Update date"}
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[13px] font-medium text-slate-600">
                  {formatOrderDate(order.date)}
                </p>
              )}
              {storeMarks(order) ? (
                <p className="mt-3 inline-flex rounded-lg bg-brand/15 px-2.5 py-1 text-[13px] font-extrabold text-ink">
                  Marks: {storeMarks(order)}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-sm font-bold text-slate-900">Products</p>
                <p className="text-[13px] font-medium text-slate-500">
                  Assignee · {assigneeLabel(order)}
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
              <div className="mt-4 space-y-3 pb-28">
                {visible.map((line) => {
                  const productId = warehouseLineProductId(line);
                  const unit = warehouseLineUnit(line);
                  const ratio = warehouseLineRatio(line);
                  const checked = lineIsChecked(line, step);
                  const busy = busyId === productId;
                  const qty = Number(line.quantityAv) || 0;
                  const stock = stockInfo(line);
                  const carton = cartonLabel(line);
                  return (
                    <article
                      key={productId || warehouseLineRef(line)}
                      className={`rounded-2xl bg-white p-4 shadow-sm ${
                        step === 2 && qty === 0 ? "bg-[#eceff1]" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold leading-snug text-black">
                        {warehouseLineName(line)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {ratio ? `${ratio} ${unit}/CTN` : `${line.quantityReq ?? 0} ${line.unitReq || ""}`}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {warehouseLineRef(line) ? (
                          <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[13px] font-extrabold text-ink">
                            {warehouseLineRef(line)}
                          </span>
                        ) : null}
                        {step === 1 ? (
                          <span className="text-sm font-bold text-black">
                            {line.quantityReq ?? 0} {line.unitReq || unit}
                          </span>
                        ) : null}
                      </div>
                      {stock && qty !== 0 && step !== 3 ? (
                        <p className={`mt-1.5 text-xs font-semibold ${step === 1 ? "text-ink" : "text-slate-700"}`}>
                          {stock}
                        </p>
                      ) : null}
                      {step !== 1 && qty !== 0 && carton ? (
                        <p className="mt-1.5 text-[13px] font-semibold text-ink">{carton}</p>
                      ) : null}

                      {step === 1 ? (
                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-slate-500">Available</p>
                            <div className="mt-1.5 flex gap-2">
                              <input
                                type="number"
                                min={0}
                                value={qty}
                                onChange={(e) =>
                                  updateLine(productId, {
                                    quantityAv: Number(e.target.value) || 0,
                                  })
                                }
                                className="h-10 w-20 rounded-[10px] border border-slate-300 bg-[#f8f9fb] px-3 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              />
                              <select
                                value={line.unitAv === "CARTONS" ? "CARTONS" : unit}
                                onChange={(e) =>
                                  updateLine(productId, {
                                    unitAv: e.target.value === "CARTONS" ? "CARTONS" : unit,
                                  })
                                }
                                className="h-10 min-w-[5.5rem] flex-1 rounded-[10px] border border-slate-300 bg-[#f8f9fb] px-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                              >
                                <option value="CARTONS">CTN</option>
                                <option value={unit}>{unit}</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 pb-0.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              onChange={(e) => void onToggle(line, e.target.checked)}
                              className="h-5 w-5 accent-[#f7a51c]"
                              aria-label="Checked"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => onZero(line)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                              aria-label="Clear quantity"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                          <p className="flex-1 text-sm font-bold text-black">
                            {qty} {line.unitAv === "CARTONS" ? "CTN" : line.unitAv || unit}
                          </p>
                          {qty !== 0 ? (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onMissing(line)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                                aria-label="Mark missing"
                              >
                                ×
                              </button>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={busy}
                                onChange={(e) => void onToggle(line, e.target.checked)}
                                className="h-5 w-5 accent-[#f7a51c]"
                                aria-label="Checked"
                              />
                            </>
                          ) : null}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="sticky bottom-0 mt-auto bg-background pt-3 pb-1">
              <div className="flex gap-2">
                <PrimaryButton
                  type="button"
                  disabled={confirming || loading}
                  onClick={() => void onConfirm()}
                  className="w-full rounded-xl py-3 text-base font-semibold"
                >
                  {confirming ? "Confirming…" : "Confirm"}
                </PrimaryButton>
                {step !== 1 ? (
                  <button
                    type="button"
                    disabled={invoicing || loading || Boolean(order.invoiceGenerated)}
                    onClick={() => void onInvoice()}
                    className="min-h-10 w-full rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {invoicing
                      ? "Sending…"
                      : order.invoiceGenerated
                        ? "Invoice sent"
                        : "Invoice"}
                  </button>
                ) : null}
              </div>
              {step < 3 ? (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[15px] font-semibold text-ink hover:underline"
                    onClick={goNext}
                  >
                    {nextLabel} →
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

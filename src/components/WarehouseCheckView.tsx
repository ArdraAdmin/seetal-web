"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import {
  checkAllWarehouseLines,
  confirmWarehouseCheck,
  getWarehouseCheckOrder,
  markWarehouseLineMissing,
  saveWarehouseCheck,
  toggleWarehouseLineCheck,
} from "@/lib/api";
import type { WarehouseCheckLine, WarehouseCheckOrder } from "@/lib/types";
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
  parseCheckStep,
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWarehouseCheckOrder(params.id, user.id, step);
      setOrder(data);
      setLines(Array.isArray(data.productDetails) ? data.productDetails : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id, step]);

  useEffect(() => {
    void load();
  }, [load]);

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
              <p className="mt-1 text-[13px] font-medium text-slate-600">
                {formatOrderDate(order.date)}
              </p>
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
              <PrimaryButton
                type="button"
                disabled={confirming || loading}
                onClick={() => void onConfirm()}
                className="w-full rounded-xl py-3 text-base font-semibold"
              >
                {confirming ? "Confirming…" : "Confirm"}
              </PrimaryButton>
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

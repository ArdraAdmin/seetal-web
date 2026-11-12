"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { resubmitApprovalOrder } from "@/lib/api";
import { apiMessage, approvalInvoice, storeIdFromOrder } from "@/lib/approval";
import { SalesOrderProductPicker } from "@/components/SalesOrderProductPicker";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { dateInputValue } from "@/lib/profiles";
import { computedPayable, lineUnitPriceEdited, salesMoney, todayDateInput } from "@/lib/sales";
import {
  addProductToShmpEditLines,
  buildShmpEditTempOrderPayload,
  packedQtyPayload,
  removeShmpEditLine,
  shmpEditCartTotals,
  shmpEditLineAggregate,
  shmpEditLinesFromDetail,
  shmpOrderSectionFromDetail,
  updateShmpEditLine,
  validateShmpEditLines,
  type ShmpEditLine,
  type ShmpOrderEditDetail,
} from "@/lib/shmp-order-edit";
import {
  cachedShmpOrderDetail,
  shmpOrderDetail,
  shmpSetCompletedQty,
  shmpStores,
  type ShmpStore,
} from "@/lib/shmp-api";
import type { ApprovalOrder } from "@/lib/types";

export default function ShmpOrderEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = String(params?.id || "");
  const cached = cachedShmpOrderDetail(orderId) as ShmpOrderEditDetail | undefined;

  const [detail, setDetail] = useState<ShmpOrderEditDetail | null>(cached || null);
  const [lines, setLines] = useState<ShmpEditLine[]>([]);
  const [stores, setStores] = useState<ShmpStore[]>([]);
  const [storeId, setStoreId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [payable, setPayable] = useState("");
  const [payableTouched, setPayableTouched] = useState(false);
  const [note, setNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayDateInput);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyDetail = useCallback((next: ShmpOrderEditDetail) => {
    setDetail(next);
    const order = next.order as ApprovalOrder | undefined;
    if (!order) {
      setError("Order not found");
      setLines([]);
      return;
    }
    const section = shmpOrderSectionFromDetail(next);
    if (section === "delivered") {
      setError("Delivered orders cannot be edited");
      setLines([]);
      return;
    }
    const nextLines = shmpEditLinesFromDetail(next);
    setLines(nextLines);
    setStoreId(storeIdFromOrder(order));
    const nextDiscount = Number(order.discount) || 0;
    setDiscount(String(nextDiscount));
    setNote(order.note && order.note !== "No note" ? order.note : "");
    const existingDate = dateInputValue(order.date || order.createdAt);
    setDeliveryDate(existingDate || todayDateInput());
    const totals = shmpEditCartTotals(nextLines);
    const computed = computedPayable(
      totals.totalCost,
      nextDiscount,
      order.isVat !== false,
    );
    setPayable(
      String(
        order.payableAmount != null ? order.payableAmount : computed.toFixed(2),
      ),
    );
    setPayableTouched(Boolean(order.payableEdited));
    setError(null);
  }, []);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [next, storeList] = await Promise.all([
        shmpOrderDetail(orderId) as Promise<ShmpOrderEditDetail>,
        shmpStores().catch(() => [] as ShmpStore[]),
      ]);
      setStores(Array.isArray(storeList) ? storeList : []);
      applyDetail(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [applyDetail, orderId]);

  useEffect(() => {
    if (cached?.order) applyDetail(cached);
    void load();
    // Apply cache once on mount; load() refreshes from the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const order = detail?.order as ApprovalOrder | undefined;
  const discountValue = Number(discount) || 0;
  const totals = useMemo(() => shmpEditCartTotals(lines), [lines]);
  const computed = useMemo(
    () => computedPayable(totals.totalCost, discountValue, order?.isVat !== false),
    [discountValue, order?.isVat, totals.totalCost],
  );
  const payableValue = Number(payable) || 0;
  const payableEdited =
    payableTouched && Math.abs(payableValue - computed) > 0.009;
  const invoice = order ? approvalInvoice(order) : orderId;
  const selectedStore = stores.find((store) => store._id === storeId);
  const orderForSave = useMemo(() => {
    if (!order) return null;
    if (!storeId) return order;
    return {
      ...order,
      store: selectedStore
        ? {
            _id: selectedStore._id,
            storeName: selectedStore.storeName,
          }
        : storeId,
    };
  }, [order, selectedStore, storeId]);

  function syncPayable(nextLines: ShmpEditLine[], nextDiscount = discountValue) {
    if (payableTouched) return;
    const nextTotals = shmpEditCartTotals(nextLines);
    setPayable(
      computedPayable(
        nextTotals.totalCost,
        nextDiscount,
        order?.isVat !== false,
      ).toFixed(2),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!orderForSave) return;
    if (!storeId) {
      toast("Choose a store", "info");
      return;
    }
    const invalid = validateShmpEditLines(lines);
    if (invalid) {
      toast(invalid, "info");
      return;
    }
    if (!deliveryDate) {
      toast("Choose a delivery date", "info");
      return;
    }
    setSaving(true);
    try {
      const payload = buildShmpEditTempOrderPayload(orderForSave, lines, {
        discount: discountValue,
        payableAmount: payableValue,
        payableEdited,
        note,
        date: deliveryDate,
      });
      const result = await resubmitApprovalOrder(payload);
      await shmpSetCompletedQty(orderId, packedQtyPayload(lines));
      toast(apiMessage(result, "Order updated"), "success");
      router.push(`/shmp/orders/${orderId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not update order", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Edit order"
        subtitle="Update commercial details and packed quantities. Delivered orders stay locked."
        actions={
          <Link
            href={`/shmp/orders/${orderId}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back
          </Link>
        }
      />

      {loading && !order ? (
        <LoadingState label="Loading order…" />
      ) : error || !order ? (
        <ErrorState message={error || "Order not found"} onRetry={() => void load()} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Card>
            <p className="text-sm font-semibold text-ink">{invoice}</p>
            <p className="mt-1 text-sm text-slate-600">
              {order.status || "Order"}
            </p>
            <label className="mt-3 block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Store</span>
              <select
                required
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>
                    {store.storeName || store.uid || store._id}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <Card>
            <p className="mb-3 text-sm font-semibold text-ink">Items</p>
            <div className="space-y-3">
              {lines.map((line) => {
                const priceEdited = lineUnitPriceEdited(line);
                return (
                  <article
                    key={line.productId}
                    className="rounded-xl border border-line/70 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {line.itemRef ? (
                          <p className="text-xs font-bold tracking-wide text-ink">
                            {line.itemRef}
                          </p>
                        ) : null}
                        <p className="font-semibold text-slate-900">{line.itemName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {line.productionStatus || "Pending"}
                          {line.deliveredQty
                            ? ` · ${line.deliveredQty} delivered`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = removeShmpEditLine(lines, line.productId);
                          setLines(next);
                          syncPayable(next);
                        }}
                        className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"
                        aria-label={`Remove ${line.itemName}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">
                          Unit price (AED)
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={Number.isFinite(line.storeCost) ? line.storeCost : 0}
                          onChange={(e) => {
                            const next = updateShmpEditLine(lines, line.productId, {
                              storeCost: Math.max(0, Number(e.target.value) || 0),
                            });
                            setLines(next);
                            setPayableTouched(false);
                            syncPayable(next);
                          }}
                          className={`h-9 w-full rounded-lg border border-line px-2 text-sm ${
                            priceEdited ? "font-semibold text-ink" : "text-slate-700"
                          }`}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">
                          Ordered qty
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={line.quantityReq}
                          onChange={(e) => {
                            const next = updateShmpEditLine(lines, line.productId, {
                              quantityReq: Math.max(0, Number(e.target.value) || 0),
                            });
                            setLines(next);
                            syncPayable(next);
                          }}
                          className="h-9 w-full rounded-lg border border-line px-2 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">
                          Unit
                        </span>
                        <select
                          value={line.unitReq}
                          onChange={(e) => {
                            const next = updateShmpEditLine(lines, line.productId, {
                              unitReq: e.target.value,
                            });
                            setLines(next);
                            syncPayable(next);
                          }}
                          className="h-9 w-full rounded-lg border border-line bg-white px-2 text-sm"
                        >
                          <option value={line.unit}>{line.unit}</option>
                          <option value="CARTONS">CARTONS</option>
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">
                          Packed qty
                        </span>
                        <input
                          type="number"
                          min={line.deliveredQty}
                          value={line.packedQty}
                          onChange={(e) => {
                            setLines(
                              updateShmpEditLine(lines, line.productId, {
                                packedQty: Math.max(
                                  line.deliveredQty,
                                  Number(e.target.value) || 0,
                                ),
                                manualCompletedQty: Math.max(
                                  line.deliveredQty,
                                  Number(e.target.value) || 0,
                                ),
                              }),
                            );
                          }}
                          className="h-9 w-full rounded-lg border border-line px-2 text-sm"
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-right text-sm font-semibold text-ink">
                      {salesMoney(shmpEditLineAggregate(line))}
                    </p>
                  </article>
                );
              })}
              {!lines.length ? (
                <p className="text-sm text-slate-500">No items on this order.</p>
              ) : null}
            </div>
          </Card>

          {storeId ? (
            <SalesOrderProductPicker
              storeId={storeId}
              tempStore={Boolean(order.isTempStore)}
              onAdd={(product, quantity, unitReq) => {
                const result = addProductToShmpEditLines(
                  lines,
                  product,
                  quantity,
                  unitReq,
                );
                if (result.error) return result.error;
                setLines(result.lines);
                syncPayable(result.lines);
                return null;
              }}
            />
          ) : null}

          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Delivery date"
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
              <TextField
                label="Discount (%)"
                type="number"
                min={0}
                max={100}
                value={discount}
                onChange={(e) => {
                  const next = e.target.value;
                  setDiscount(next);
                  syncPayable(lines, Number(next) || 0);
                }}
              />
              <TextField
                label="Payable (AED)"
                type="number"
                step="0.01"
                value={payable}
                onChange={(e) => {
                  setPayableTouched(true);
                  setPayable(e.target.value);
                }}
              />
              <div className="rounded-lg border border-line bg-[#faf9f6] px-3 py-2 text-sm text-slate-600">
                <p>Subtotal: {salesMoney(totals.totalCost)}</p>
                <p className="mt-1">Computed payable: {salesMoney(computed)}</p>
              </div>
            </div>
            <label className="mt-3 block space-y-1.5">
              <span className="text-[13px] font-medium text-slate-700">Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>
            <p className="mt-3 text-sm text-slate-600">
              Worker assignments stay on the order. Use Record packing to add packing
              splits; packed qty here sets the admin completed quantity.
            </p>
            <div className="mt-4 flex gap-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save order"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => router.push(`/shmp/orders/${orderId}`)}
              >
                Cancel
              </SecondaryButton>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}

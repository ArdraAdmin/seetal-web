"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  createPayment,
  editPayment,
  getConfirmedInvoice,
  getInvoiceLines,
  getInvoiceStoreDetails,
  getPayments,
  getProduct,
  saveGrvEdit,
  toggleGrvDamaged,
  updateInventoryQuantities,
} from "@/lib/api";
import type { GrvDisposition, GrvLine, GrvOrder } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  formatInvoiceDate,
  grvRemarkNote,
  invoiceNumberOf,
  invoiceStoreName,
  invoiceTotal,
  isGrvPayment,
  lineAmount,
  lineGrvQty,
  lineGrvUnit,
  lineIsDamaged,
  lineIsReturned,
  lineProduct,
  lineProductId,
  lineProductName,
  lineRatio,
  lineUnit,
  PAYMENT_CURRENCY,
  paymentOrderId,
  productPieces,
  toPieces,
} from "@/lib/invoice";
import { roundMoney, salesMoney } from "@/lib/sales";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";

interface EditorLine {
  key: string;
  productId: string;
  masterCategoryId: string;
  itemRef: string;
  name: string;
  unit: string;
  ratio: number;
  storeCost: number;
  shippedQty: number;
  shippedUnit: string;
  selected: boolean;
  qty: number;
  grvUnit: string;
  disposition: GrvDisposition;
  existingQty: number;
  existingUnit: string;
  existingReturned: boolean;
  existingDamaged: boolean;
}

function toEditorLine(line: GrvLine, fallbackCategory = ""): EditorLine | null {
  const productId = lineProductId(line);
  if (!productId) return null;
  const product = lineProduct(line);
  const masterCategoryId =
    product?.masterCategoryId || String(line.categoryId || fallbackCategory);
  const returned = lineIsReturned(line);
  const qty = returned ? lineGrvQty(line) : Number(line.quantityAv) || 0;
  const unit = returned ? lineGrvUnit(line) : String(line.unitAv || lineUnit(line));
  return {
    key: `${productId}:${masterCategoryId}`,
    productId,
    masterCategoryId,
    itemRef: product?.itemRef || "",
    name: lineProductName(line),
    unit: lineUnit(line),
    ratio: lineRatio(line),
    storeCost: Number(line.storeCost) || 0,
    shippedQty: Number(line.quantityAv) || 0,
    shippedUnit: String(line.unitAv || lineUnit(line)),
    selected: returned,
    qty,
    grvUnit: unit,
    disposition: lineIsDamaged(line) ? "damaged" : "inventory",
    existingQty: lineGrvQty(line),
    existingUnit: lineGrvUnit(line),
    existingReturned: returned,
    existingDamaged: lineIsDamaged(line),
  };
}

export default function AdminGrvInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<GrvOrder | null>(null);
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      let invoice = await getConfirmedInvoice(user.id, params.id);
      if (!invoice) {
        const details = await getInvoiceStoreDetails(user.id, params.id);
        invoice = {
          _id: params.id,
          store: details.store,
          sales: details.sales,
        };
      }
      const { lines: invoiceLines } = await getInvoiceLines(user.id, invoice);
      const editors = invoiceLines
        .map((line) => toEditorLine(line))
        .filter((line): line is EditorLine => Boolean(line));
      setOrder({ ...invoice, productDetails: invoiceLines });
      setLines(editors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = lines.filter((line) => line.selected && line.qty > 0);
  const grvAmount = roundMoney(
    selected.reduce(
      (sum, line) => sum + lineAmount(line.qty, line.grvUnit, line.storeCost, line.ratio),
      0,
    ),
  );

  const invoiceLabel = order ? invoiceNumberOf(order) : "";

  const grouped = useMemo(() => {
    const map = new Map<string, EditorLine[]>();
    for (const line of lines) {
      const key = line.masterCategoryId || "uncategorised";
      const list = map.get(key) || [];
      list.push(line);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [lines]);

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  async function onSave() {
    if (!user?.id || !order) return;
    if (selected.length === 0) {
      toast("Tick at least one returned product", "info");
      return;
    }
    for (const line of selected) {
      if (line.qty <= 0) {
        toast(`Enter a return quantity for ${line.name}`, "info");
        return;
      }
    }
    setSaving(true);
    try {
      const byCategory = new Map<string, EditorLine[]>();
      for (const line of selected) {
        const cat = line.masterCategoryId || "uncategorised";
        const list = byCategory.get(cat) || [];
        list.push(line);
        byCategory.set(cat, list);
      }
      const fallbackCategory =
        order.categoryList?.find((item) => item.masterCategoryId)?.masterCategoryId ||
        lines.find((line) => line.masterCategoryId)?.masterCategoryId ||
        "";
      for (const [masterCategoryId, group] of byCategory) {
        const categoryId =
          masterCategoryId === "uncategorised" ? fallbackCategory : masterCategoryId;
        if (!categoryId) {
          throw new Error("This invoice has no category to save GRV against");
        }
        await saveGrvEdit({
          userId: user.id,
          orderId: order._id,
          masterCategoryId: categoryId,
          productDetails: group.map((line) => ({
            productId: line.productId,
            isDamaged: line.disposition === "damaged",
            grv: {
              isGRV: true,
              grvQty: line.qty,
              grvUnit: line.grvUnit,
            },
          })),
        });
      }

      for (const line of selected) {
        await toggleGrvDamaged(
          order._id,
          line.productId,
          line.disposition === "damaged",
        );
      }

      const stockUpdates: { itemRef: string; closingQty: number }[] = [];
      for (const line of selected) {
        const prevReturnedPieces =
          line.existingReturned && !line.existingDamaged
            ? toPieces(line.existingQty, line.existingUnit, line.ratio)
            : 0;
        const nextReturnedPieces =
          line.disposition === "inventory"
            ? toPieces(line.qty, line.grvUnit, line.ratio)
            : 0;
        const delta = nextReturnedPieces - prevReturnedPieces;
        if (delta === 0) continue;
        const product = await getProduct(line.productId);
        const itemRef = product.itemRef || line.itemRef;
        if (!itemRef) continue;
        stockUpdates.push({
          itemRef,
          closingQty: productPieces(product) + delta,
        });
      }
      if (stockUpdates.length > 0) {
        await updateInventoryQuantities(stockUpdates);
      }

      if (grvAmount > 0) {
        const payments = await getPayments(user.id);
        const existing = payments.find(
          (payment) =>
            paymentOrderId(payment) === order._id && isGrvPayment(payment),
        );
        const payload = {
          paymentMode: "Cash",
          date: new Date().toISOString(),
          orderId: order._id,
          currency: PAYMENT_CURRENCY,
          note: grvRemarkNote(grvAmount),
          amountPaid: 0,
        };
        if (existing) {
          await editPayment({ paymentId: existing._id, ...payload });
        } else {
          await createPayment(payload);
        }
      }

      toast("GRV saved", "success");
      router.push("/admin/grv");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save GRV", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={invoiceLabel || "Invoice"}
        subtitle="Tick returned products, enter quantity, then save. Returned-to-inventory items go back into stock; damaged items do not."
        actions={
          <Link
            href="/admin/grv"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back
          </Link>
        }
      />

      {loading ? (
        <LoadingState label="Loading invoice…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !order ? (
        <ErrorState message="Invoice not found" />
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="text-sm text-slate-600">{invoiceStoreName(order)}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatInvoiceDate(order.date || order.createdAt)}
            </p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Invoice</p>
                <p className="font-semibold text-ink">{salesMoney(invoiceTotal(order))}</p>
              </div>
              <div>
                <p className="text-slate-500">Selected GRV</p>
                <p className="font-semibold text-ink">{salesMoney(grvAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Collectable after GRV</p>
                <p className="font-semibold text-ink">
                  {salesMoney(Math.max(0, invoiceTotal(order) - grvAmount))}
                </p>
              </div>
            </div>
          </Card>

          {grouped.map(([category, group]) => (
            <div key={category} className="space-y-2">
              {group.map((line) => {
                const maxHint = `${line.shippedQty} ${line.shippedUnit}`;
                return (
                  <div
                    key={line.key}
                    className={`rounded-xl border bg-white p-4 ${
                      line.selected ? "border-brand" : "border-line"
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={line.selected}
                        onChange={(e) =>
                          updateLine(line.key, {
                            selected: e.target.checked,
                            qty: e.target.checked
                              ? line.qty || line.shippedQty
                              : line.qty,
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-black">{line.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Shipped {maxHint}
                          {line.itemRef ? ` · ${line.itemRef}` : ""}
                        </span>
                      </span>
                    </label>
                    {line.selected ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block space-y-1.5">
                          <span className="text-[13px] font-medium text-slate-700">
                            Return qty
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="1"
                            value={line.qty}
                            onChange={(e) =>
                              updateLine(line.key, {
                                qty: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                          />
                        </label>
                        <label className="block space-y-1.5">
                          <span className="text-[13px] font-medium text-slate-700">
                            Unit
                          </span>
                          <select
                            value={line.grvUnit}
                            onChange={(e) =>
                              updateLine(line.key, { grvUnit: e.target.value })
                            }
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                          >
                            <option value="CARTONS">CARTONS</option>
                            {line.unit && line.unit.toUpperCase() !== "CARTONS" ? (
                              <option value={line.unit}>{line.unit}</option>
                            ) : (
                              <option value="PCS">PCS</option>
                            )}
                          </select>
                        </label>
                        <div className="space-y-1.5">
                          <span className="text-[13px] font-medium text-slate-700">
                            What happens to this item
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                              <input
                                type="radio"
                                name={`disp-${line.key}`}
                                checked={line.disposition === "inventory"}
                                onChange={() =>
                                  updateLine(line.key, { disposition: "inventory" })
                                }
                              />
                              Return to inventory
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                              <input
                                type="radio"
                                name={`disp-${line.key}`}
                                checked={line.disposition === "damaged"}
                                onChange={() =>
                                  updateLine(line.key, { disposition: "damaged" })
                                }
                              />
                              Mark as damaged
                            </label>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {line.selected ? (
                      <p className="mt-2 text-xs text-slate-500">
                        GRV value {salesMoney(lineAmount(line.qty, line.grvUnit, line.storeCost, line.ratio))}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <PrimaryButton type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? "Saving…" : "Save GRV"}
            </PrimaryButton>
            <SecondaryButton type="button" disabled={saving} onClick={() => router.push("/admin/grv")}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

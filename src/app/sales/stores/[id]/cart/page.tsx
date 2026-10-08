"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { placeSalesOrder, placeSalesOrderPayload } from "@/lib/api";
import { apiMessage } from "@/lib/approval";
import { clearCart, loadCart, saveCart } from "@/lib/sales-cart";
import {
  cartTotals,
  cartUnitPriceEdited,
  computedPayable,
  lineAggregate,
  lineUnitPriceEdited,
  roundMoney,
  salesMoney,
  todayDateInput,
} from "@/lib/sales";
import type { SalesCartLine } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { EmptyState, PrimaryButton, TextField } from "@/components/ui";
import { ensureLocationEnabled } from "@/lib/sales-location";

export default function SalesCartPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = params.id;
  const storeName = searchParams.get("name") || "Store";
  const marks = searchParams.get("marks") || "";
  const tempStore = searchParams.get("temp") === "1";

  const [lines, setLines] = useState<SalesCartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState(todayDateInput);
  const [payableText, setPayableText] = useState("");
  const [payableEdited, setPayableEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureLocationEnabled();
      if (cancelled) return;
      if (!ok) {
        toast(
          "Turn on location on your device to place orders.",
          "info",
        );
        router.replace(
          `/sales/stores/${storeId}?name=${encodeURIComponent(storeName)}&marks=${encodeURIComponent(marks)}${tempStore ? "&temp=1" : ""}`,
        );
        return;
      }
      setLocationReady(true);
      setLines(loadCart(storeId));
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, storeName, marks, tempStore, router, toast]);

  const { totalCost, totalQuantity } = useMemo(() => cartTotals(lines), [lines]);
  const unitPriceEdited = useMemo(() => cartUnitPriceEdited(lines), [lines]);
  const payable = payableEdited
    ? Number(payableText) || 0
    : computedPayable(totalCost, discount, true);

  useEffect(() => {
    if (!payableEdited) setPayableText(computedPayable(totalCost, discount, true).toFixed(2));
  }, [totalCost, discount, payableEdited]);

  const discountAmount = roundMoney((totalCost / 100) * discount);

  function updateLine(productId: string, patch: Partial<SalesCartLine>) {
    const next = lines
      .map((line) => (line.productId === productId ? { ...line, ...patch } : line))
      .filter((line) => line.quantityReq > 0);
    setLines(next);
    saveCart(storeId, next);
  }

  function removeLine(productId: string) {
    const next = lines.filter((line) => line.productId !== productId);
    setLines(next);
    saveCart(storeId, next);
  }

  async function onPlace() {
    if (!user?.id) return;
    const ok = await ensureLocationEnabled();
    if (!ok) {
      toast("Turn on location on your device to place orders.", "info");
      return;
    }
    if (lines.length === 0) {
      toast("Add products to the cart first", "info");
      return;
    }
    const today = todayDateInput();
    if (!deliveryDate) {
      toast("Choose a delivery date", "info");
      return;
    }
    if (deliveryDate < today) {
      toast("Delivery date cannot be in the past", "info");
      return;
    }
    setSubmitting(true);
    try {
      const body = placeSalesOrderPayload({
        salesId: user.id,
        storeId,
        lines,
        discount,
        payableAmount: payable,
        payableEdited,
        date: deliveryDate,
        tempStore,
      });
      const result = await placeSalesOrder(body);
      clearCart(storeId);
      const needsApproval = discount > 0 || payableEdited || unitPriceEdited;
      toast(
        apiMessage(
          result,
          needsApproval
            ? "Order sent for admin approval"
            : "Order placed. The order form will be emailed shortly.",
        ),
        "success",
      );
      router.push("/sales/pending");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not place order", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const needsApproval = discount > 0 || payableEdited || unitPriceEdited;
  const productsHref = `/sales/stores/${storeId}?name=${encodeURIComponent(storeName)}&marks=${encodeURIComponent(marks)}${tempStore ? "&temp=1" : ""}`;

  if (!locationReady) {
    return (
      <div className="mx-auto max-w-3xl py-10 text-center text-sm text-slate-500">
        Checking location…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={productsHref} className="text-sm font-medium text-ink hover:underline">
        ← Products
      </Link>
      <h1 className="mt-2 text-xl font-bold text-slate-900">Cart</h1>
      <p className="mt-1 text-sm text-slate-500">{storeName}</p>

      {lines.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Cart is empty" description="Add products, then place the order." />
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            {lines.map((line) => {
              const priceEdited = lineUnitPriceEdited(line);
              return (
                <article
                  key={line.productId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    {line.itemRef ? (
                      <p className="text-xs font-bold tracking-wide text-ink">{line.itemRef}</p>
                    ) : null}
                    <p className="font-semibold text-slate-900">{line.itemName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <span>AED</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={Number.isFinite(line.storeCost) ? line.storeCost : 0}
                          onChange={(e) => {
                            const next = Math.max(0, Number(e.target.value) || 0);
                            updateLine(line.productId, { storeCost: next });
                            setPayableEdited(false);
                          }}
                          className={`h-8 w-24 rounded-lg border border-line px-2 text-sm ${
                            priceEdited ? "font-semibold text-ink" : "text-slate-700"
                          }`}
                          aria-label={`Unit price for ${line.itemName}`}
                        />
                        <span>/ {line.unit}</span>
                      </label>
                      {priceEdited ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-ink hover:underline"
                          onClick={() => {
                            updateLine(line.productId, {
                              storeCost: Number(line.catalogStoreCost) || 0,
                            });
                            setPayableEdited(false);
                          }}
                        >
                          Reset ({salesMoney(Number(line.catalogStoreCost) || 0)})
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={line.unitReq}
                      onChange={(e) => updateLine(line.productId, { unitReq: e.target.value })}
                      className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
                    >
                      <option value={line.unit}>{line.unit}</option>
                      <option value="CARTONS">CTN</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={line.quantityReq}
                      onChange={(e) =>
                        updateLine(line.productId, {
                          quantityReq: Number(e.target.value) || 0,
                        })
                      }
                      className="h-9 w-20 rounded-lg border border-line px-2 text-sm"
                    />
                    <p className="w-24 text-right text-sm font-bold">
                      {salesMoney(lineAggregate(line))}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeLine(line.productId)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${line.itemName}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-line bg-white p-4">
            <Row label="Items" value={`${lines.length}`} />
            <Row label="Quantity" value={`${totalQuantity}`} />
            <Row label="Total" value={salesMoney(totalCost)} />
            <TextField
              label="Delivery date"
              type="date"
              required
              min={todayDateInput()}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <TextField
              label="Discount %"
              type="number"
              min={0}
              max={100}
              value={String(discount || "")}
              onChange={(e) => {
                setDiscount(Math.max(0, Number(e.target.value) || 0));
                setPayableEdited(false);
              }}
            />
            {discount > 0 ? (
              <Row
                label={`Discount (${discount}%)`}
                value={`− ${salesMoney(discountAmount)}`}
              />
            ) : null}
            <TextField
              label="Payable"
              type="number"
              min={0}
              step="0.01"
              value={payableText}
              onChange={(e) => {
                setPayableEdited(true);
                setPayableText(e.target.value);
              }}
            />
            {payableEdited ? (
              <button
                type="button"
                className="text-xs font-medium text-ink hover:underline"
                onClick={() => {
                  setPayableEdited(false);
                  setPayableText(computedPayable(totalCost, discount, true).toFixed(2));
                }}
              >
                Reset payable
              </button>
            ) : null}
            <p className="text-lg font-bold text-slate-900">
              Payable {salesMoney(payable)}
            </p>
            {needsApproval ? (
              <p className="text-sm text-slate-600">
                This order will be sent to admin for approval.
              </p>
            ) : null}
            <PrimaryButton
              type="button"
              disabled={submitting}
              className="w-full py-3"
              onClick={() => void onPlace()}
            >
              {submitting
                ? "Placing…"
                : needsApproval
                  ? "Send for approval"
                  : "Confirm order"}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

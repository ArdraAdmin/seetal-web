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
  computedPayable,
  lineAggregate,
  roundMoney,
  salesMoney,
} from "@/lib/sales";
import type { SalesCartLine } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { EmptyState, PrimaryButton, TextField } from "@/components/ui";

export default function SalesCartPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = params.id;
  const storeName = searchParams.get("name") || "Store";
  const marks = searchParams.get("marks") || "";

  const [lines, setLines] = useState<SalesCartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [payableText, setPayableText] = useState("");
  const [payableEdited, setPayableEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLines(loadCart(storeId));
  }, [storeId]);

  const { totalCost, totalQuantity } = useMemo(() => cartTotals(lines), [lines]);
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
    if (lines.length === 0) {
      toast("Add products to the cart first", "info");
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
        date: new Date().toISOString().slice(0, 10),
      });
      const result = await placeSalesOrder(body);
      clearCart(storeId);
      const needsApproval = discount > 0 || payableEdited;
      toast(
        apiMessage(
          result,
          needsApproval ? "Order sent for admin approval" : "Order has been placed",
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

  const needsApproval = discount > 0 || payableEdited;
  const productsHref = `/sales/stores/${storeId}?name=${encodeURIComponent(storeName)}&marks=${encodeURIComponent(marks)}`;

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
            {lines.map((line) => (
              <article
                key={line.productId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{line.itemName}</p>
                  <p className="text-xs text-slate-500">
                    {line.itemRef} · {salesMoney(line.storeCost)} / {line.unit}
                  </p>
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
            ))}
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-line bg-white p-4">
            <Row label="Items" value={`${lines.length}`} />
            <Row label="Quantity" value={`${totalQuantity}`} />
            <Row label="Total" value={salesMoney(totalCost)} />
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

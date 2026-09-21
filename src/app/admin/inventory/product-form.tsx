"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProductManual,
  getMasterCategories,
  updateProduct,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";

type MasterCat = { _id?: string; id?: string; name?: string; value?: string };

const EMPTY_FORM = {
  itemRef: "",
  itemName: "",
  barCode: "",
  category: "",
  subCategory: "",
  unit: "PCS",
  ratio: "1",
  amountInUnits: "0",
  sellingPrice: "0",
  isDisplay: true,
};

function formFromProduct(product: Product) {
  return {
    itemRef: String(product.itemRef ?? ""),
    itemName: String(product.itemName ?? ""),
    barCode: String(product.barCode ?? ""),
    category: String(product.masterCategoryId ?? ""),
    subCategory:
      typeof product.category === "object" &&
      product.category &&
      "_id" in product.category
        ? String((product.category as { _id?: string })._id ?? "")
        : "",
    unit: String(product.unit ?? "PCS"),
    ratio: String(product.ratio ?? 1),
    amountInUnits: String(
      (product.inQty?.amountInCartons ?? 0) * (product.ratio ?? 1) +
        (product.inQty?.amountInUnits ?? 0),
    ),
    sellingPrice: String(product.sellingPrice ?? 0),
    isDisplay: Boolean(product.isDisplay ?? true),
  };
}

export function ProductForm({
  product,
}: {
  product?: Product | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(product?._id);
  const [saving, setSaving] = useState(false);
  const [masterCats, setMasterCats] = useState<MasterCat[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    void (async () => {
      try {
        const cats = await getMasterCategories();
        if (Array.isArray(cats)) setMasterCats(cats as MasterCat[]);
      } catch {
        // optional for form
      }
    })();
  }, []);

  useEffect(() => {
    if (product) {
      setForm(formFromProduct(product));
      return;
    }
    setForm((prev) => ({
      ...EMPTY_FORM,
      category: prev.category,
    }));
  }, [product]);

  useEffect(() => {
    if (product || form.category) return;
    const first = masterCats[0]?._id || masterCats[0]?.id || "";
    if (first) setForm((prev) => ({ ...prev, category: first }));
  }, [masterCats, product, form.category]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        productId: product?._id ?? "",
        barCode: form.barCode,
        itemRef: form.itemRef,
        category: form.category,
        subCategory: form.subCategory,
        itemName: form.itemName,
        unit: form.unit,
        ratio: Number(form.ratio),
        amountInUnits: Number(form.amountInUnits),
        sellingPrice: Number(form.sellingPrice),
        isDisplay: form.isDisplay,
      };
      if (editing) {
        await updateProduct(payload);
        toast("Product updated", "success");
      } else {
        await addProductManual(payload);
        toast("Product added", "success");
      }
      router.push("/admin/inventory");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TextField
          label="Item ref"
          required
          value={form.itemRef}
          onChange={(e) => setForm({ ...form, itemRef: e.target.value })}
        />
        <TextField
          label="Item name"
          required
          value={form.itemName}
          onChange={(e) => setForm({ ...form, itemName: e.target.value })}
        />
        <TextField
          label="Barcode"
          value={form.barCode}
          onChange={(e) => setForm({ ...form, barCode: e.target.value })}
        />
        <TextField
          label="Master category ID"
          required
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Mongo category id"
        />
        <TextField
          label="Sub category ID"
          required
          value={form.subCategory}
          onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
          placeholder="SubCategory enum id"
        />
        <TextField
          label="Unit"
          required
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
        <TextField
          label="Ratio"
          required
          type="number"
          value={form.ratio}
          onChange={(e) => setForm({ ...form, ratio: e.target.value })}
        />
        <TextField
          label="Amount in units"
          required
          type="number"
          value={form.amountInUnits}
          onChange={(e) => setForm({ ...form, amountInUnits: e.target.value })}
        />
        <TextField
          label="Selling price"
          required
          type="number"
          value={form.sellingPrice}
          onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
        />
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isDisplay}
            onChange={(e) =>
              setForm({ ...form, isDisplay: e.target.checked })
            }
          />
          Display in catalog
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            onClick={() => router.push("/admin/inventory")}
          >
            Cancel
          </SecondaryButton>
        </div>
      </form>
      {masterCats.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Master categories loaded:{" "}
          {masterCats
            .slice(0, 5)
            .map((c) => c.name || c.value || c._id || c.id)
            .join(", ")}
          {masterCats.length > 5 ? "…" : ""}
        </p>
      ) : null}
    </Card>
  );
}

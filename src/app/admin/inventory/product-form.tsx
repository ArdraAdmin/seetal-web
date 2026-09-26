"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProductManual,
  getCategories,
  updateProduct,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { parseCategoryGroups, type CategoryGroup } from "@/lib/categories";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";

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

function nestedCategory(product?: Product | null) {
  return typeof product?.category === "object" && product.category
    ? product.category
    : null;
}

function formFromProduct(product: Product) {
  const nested = nestedCategory(product);
  return {
    itemRef: String(product.itemRef ?? ""),
    itemName: String(product.itemName ?? ""),
    barCode: String(product.barCode ?? product.barcode ?? ""),
    category: String(product.masterCategoryId ?? nested?.masterCategoryId ?? ""),
    subCategory: String(
      nested?._id ?? product.subCategoryId ?? product.categoryId ?? "",
    ),
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

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      <select
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:bg-[#f7f5f0] sm:text-sm"
      >
        {children}
      </select>
    </label>
  );
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
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    void (async () => {
      try {
        const parsed = parseCategoryGroups(await getCategories());
        if (!cancelled) setGroups(parsed);
      } catch {
        if (!cancelled) {
          setGroups([]);
          toast("Could not load categories", "error");
        }
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (product) {
      setForm(formFromProduct(product));
      return;
    }
    setForm(EMPTY_FORM);
  }, [product]);

  useEffect(() => {
    if (groups.length === 0) return;
    setForm((current) => {
      const group =
        groups.find(
          (item) =>
            item.masterCategoryId === current.category ||
            item.name === current.category,
        ) ||
        (product
          ? groups.find(
              (item) =>
                item.masterCategoryId === product.masterCategoryId ||
                item.name === nestedCategory(product)?.masterCategory,
            )
          : null);
      if (!group) return current;
      const masterId = group.masterCategoryId || group.name;
      const nested = nestedCategory(product);
      const subName =
        nested?.subCategory ||
        (typeof product?.category === "string" ? product.category : "");
      const match =
        group.items.find((item) => item._id === current.subCategory) ||
        group.items.find((item) => item.subCategory === current.subCategory) ||
        group.items.find((item) => item._id === nested?._id) ||
        group.items.find((item) => item.subCategory === subName);
      const nextSub = match?._id || match?.subCategory || current.subCategory;
      if (current.category === masterId && current.subCategory === nextSub) {
        return current;
      }
      return { ...current, category: masterId, subCategory: nextSub };
    });
  }, [groups, product]);

  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) =>
          group.masterCategoryId === form.category || group.name === form.category,
      ) || null,
    [groups, form.category],
  );

  const subOptions = useMemo(
    () =>
      [...(selectedGroup?.items ?? [])].sort((a, b) =>
        String(a.subCategory || "").localeCompare(String(b.subCategory || "")),
      ),
    [selectedGroup],
  );

  function onMasterChange(value: string) {
    setForm((current) => ({
      ...current,
      category: value,
      subCategory: "",
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const group = selectedGroup;
    const sub = subOptions.find((item) => item._id === form.subCategory);
    if (!group || !form.subCategory) {
      toast("Select a category and sub category", "info");
      return;
    }
    setSaving(true);
    try {
      const payload = editing
        ? {
            productId: product?._id ?? "",
            barCode: form.barCode,
            itemRef: form.itemRef,
            category: group.name,
            subCategory: sub?.subCategory || form.subCategory,
            itemName: form.itemName,
            unit: form.unit,
            ratio: Number(form.ratio),
            amountInUnits: Number(form.amountInUnits),
            sellingPrice: Number(form.sellingPrice),
            isDisplay: form.isDisplay,
          }
        : {
            productId: product?._id ?? "",
            barCode: form.barCode,
            itemRef: form.itemRef,
            category: group.masterCategoryId || group.name,
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
        <SelectField
          label="Category"
          required
          value={form.category}
          onChange={onMasterChange}
        >
          <option value="">
            {loadingCategories ? "Loading categories…" : "Select category"}
          </option>
          {groups.map((group) => (
            <option
              key={group.masterCategoryId || group.name}
              value={group.masterCategoryId || group.name}
            >
              {group.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sub category"
          required
          disabled={!selectedGroup || loadingCategories}
          value={form.subCategory}
          onChange={(value) => setForm({ ...form, subCategory: value })}
        >
          <option value="">
            {loadingCategories
              ? "Loading categories…"
              : selectedGroup
                ? "Select sub category"
                : "Select a category first"}
          </option>
          {subOptions.map((item) => (
            <option
              key={item._id || item.subCategory}
              value={item._id || item.subCategory}
            >
              {item.subCategory || "Sub category"}
            </option>
          ))}
        </SelectField>
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
    </Card>
  );
}

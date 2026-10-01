"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProductManual,
  checkProductsByItemRefs,
  companyLabel,
  existingItemLabel,
  getCategories,
  getCompanies,
  normalizeItemRef,
  updateProduct,
  type CompanyRecord,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { parseCategoryGroups, type CategoryGroup } from "@/lib/categories";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";

const COMPANY_ORDER = ["SH Lakshmi", "SHMP", "Sarvah", "STL"] as const;

const COMPANY_ALIASES: Record<(typeof COMPANY_ORDER)[number], string[]> = {
  "SH Lakshmi": ["shlakshmi", "shlaxmi"],
  SHMP: ["shmp"],
  Sarvah: ["sarvah"],
  STL: ["stl"],
};

function normalizeCompanyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function companyIdFromProduct(product?: Product | null) {
  const raw = product?.company;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") return String(raw._id ?? "");
  return "";
}

function displayCompanyName(company: CompanyRecord) {
  const hay = normalizeCompanyKey(
    `${company.name ?? ""} ${company.prefix ?? ""}`,
  );
  for (const label of COMPANY_ORDER) {
    if (COMPANY_ALIASES[label].some((alias) => hay === alias || hay.includes(alias))) {
      return label;
    }
  }
  return companyLabel(company);
}

function orderedCompanies(list: CompanyRecord[]) {
  const used = new Set<string>();
  const preferred: CompanyRecord[] = [];
  for (const label of COMPANY_ORDER) {
    const match = list.find(
      (company) =>
        !used.has(company._id) && displayCompanyName(company) === label,
    );
    if (match) {
      used.add(match._id);
      preferred.push(match);
    }
  }
  if (preferred.length > 0) return preferred;
  return list;
}

const EMPTY_FORM = {
  itemRef: "",
  itemName: "",
  barCode: "",
  category: "",
  subCategory: "",
  company: "",
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

function asCategoryId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in (value as object)) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  return "";
}

function productSubCategoryId(product?: Product | null) {
  if (!product) return "";
  const nested = nestedCategory(product);
  return (
    asCategoryId(nested) ||
    asCategoryId(product.category) ||
    String(product.subCategoryId ?? product.categoryId ?? "")
  );
}

function productSubCategoryName(product?: Product | null) {
  return String(nestedCategory(product)?.subCategory ?? "");
}

function matchCategorySelection(
  product: Product | undefined,
  groups: CategoryGroup[],
  current?: { category: string; subCategory: string },
) {
  const subId = current?.subCategory || productSubCategoryId(product);
  const subName = productSubCategoryName(product);
  const masterHint =
    current?.category ||
    String(
      product?.masterCategoryId ??
        nestedCategory(product)?.masterCategoryId ??
        "",
    );

  const same = (left?: string, right?: string) =>
    String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();

  for (const group of groups) {
    const item =
      group.items.find((entry) => entry._id && entry._id === subId) ||
      (subName
        ? group.items.find((entry) => same(entry.subCategory, subName))
        : undefined);
    if (item) {
      return {
        category: group.masterCategoryId || group.name,
        subCategory: item._id || item.subCategory || "",
      };
    }
  }

  const group = groups.find(
    (entry) =>
      entry.masterCategoryId === masterHint || entry.name === masterHint,
  );
  if (group) {
    const item =
      group.items.find((entry) => entry._id === subId) ||
      group.items.find((entry) => same(entry.subCategory, subId)) ||
      group.items.find((entry) => same(entry.subCategory, subName));
    return {
      category: group.masterCategoryId || group.name,
      subCategory: item?._id || item?.subCategory || subId,
    };
  }

  return { category: masterHint, subCategory: subId };
}

function formFromProduct(product: Product, groups: CategoryGroup[] = []) {
  const matched = matchCategorySelection(product, groups);
  return {
    itemRef: String(product.itemRef ?? ""),
    itemName: String(product.itemName ?? ""),
    barCode: String(product.barCode ?? product.barcode ?? ""),
    category: matched.category,
    subCategory: matched.subCategory,
    company: companyIdFromProduct(product),
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
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [existsError, setExistsError] = useState<string | null>(null);

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
    let cancelled = false;
    setLoadingCompanies(true);
    void (async () => {
      try {
        const list = orderedCompanies(await getCompanies());
        if (!cancelled) setCompanies(list);
      } catch {
        if (!cancelled) {
          setCompanies([]);
          toast("Could not load companies", "error");
        }
      } finally {
        if (!cancelled) setLoadingCompanies(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (product) {
      setForm(formFromProduct(product, groups));
      return;
    }
    setForm(EMPTY_FORM);
  }, [product, groups]);

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
    if (!form.company) {
      toast("Select a company", "info");
      return;
    }
    setSaving(true);
    setExistsError(null);
    try {
      if (!editing) {
        const existing = await checkProductsByItemRefs([form.itemRef]);
        if (existing.length > 0) {
          const label = existingItemLabel(existing[0]);
          setExistsError(label);
          toast("This item already exists", "error");
          return;
        }
      }
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
            company: form.company,
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
            company: form.company,
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
      const message = err instanceof Error ? err.message : "Save failed";
      if (!editing && /duplicate|e11000|already exist/i.test(message)) {
        const ref = normalizeItemRef(form.itemRef);
        setExistsError(ref || "This item ref is already in inventory.");
        toast("This item already exists", "error");
      } else {
        toast(message, "error");
      }
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
        {existsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:col-span-2 lg:col-span-3">
            <p className="font-semibold">This item already exists</p>
            <p className="mt-1">
              {existsError}. It was not added.
            </p>
          </div>
        ) : null}
        <TextField
          label="Item ref"
          required
          value={form.itemRef}
          onChange={(e) => {
            setExistsError(null);
            setForm({ ...form, itemRef: e.target.value });
          }}
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
          {form.subCategory &&
          !subOptions.some(
            (item) => (item._id || item.subCategory) === form.subCategory,
          ) ? (
            <option value={form.subCategory}>
              {productSubCategoryName(product) || "Current sub category"}
            </option>
          ) : null}
          {subOptions.map((item) => (
            <option
              key={item._id || item.subCategory}
              value={item._id || item.subCategory}
            >
              {item.subCategory || "Sub category"}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Company"
          required
          disabled={loadingCompanies}
          value={form.company}
          onChange={(value) => setForm({ ...form, company: value })}
        >
          <option value="">
            {loadingCompanies ? "Loading companies…" : "Select company"}
          </option>
          {form.company &&
          !companies.some((company) => company._id === form.company) ? (
            <option value={form.company}>Current company</option>
          ) : null}
          {companies.map((company) => (
            <option key={company._id} value={company._id}>
              {displayCompanyName(company)}
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

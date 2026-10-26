"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { companyLabel, type CompanyRecord } from "@/lib/api";
import type { CategoryGroup } from "@/lib/categories";
import {
  baseItemCodeOf,
  isStlCompanyLabel,
  SHMP_OWN_SOURCE,
  type ShmpInventoryProduct,
  type ShmpStore,
  type ShmpStoreProfileInput,
} from "@/lib/shmp-api";
import { FieldLabel, SecondaryButton, TextField } from "@/components/ui";

export type PricingRow = {
  key: string;
  storeId: string;
  storePrice: string;
  storeItemCode: string;
};

export type ProductFormState = {
  itemRef: string;
  itemName: string;
  barCode: string;
  baseItemCode: string;
  category: string;
  subCategory: string;
  company: string;
  unit: string;
  ratio: string;
  amountInUnits: string;
  sellingPrice: string;
  isDisplay: boolean;
  description: string;
  dimensions: string;
  weight: string;
  pricing: PricingRow[];
};

export const EMPTY_FORM: ProductFormState = {
  itemRef: "",
  itemName: "",
  barCode: "",
  baseItemCode: "",
  category: "",
  subCategory: "",
  company: "",
  unit: "PCS",
  ratio: "1",
  amountInUnits: "0",
  sellingPrice: "0",
  isDisplay: true,
  description: "",
  dimensions: "",
  weight: "",
  pricing: [],
};

export function blankForm(company = ""): ProductFormState {
  return { ...EMPTY_FORM, company, pricing: [] };
}

function newPricingRow(): PricingRow {
  return {
    key: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    storeId: "",
    storePrice: "",
    storeItemCode: "",
  };
}

export function companyIdOf(product: ShmpInventoryProduct) {
  const raw = product.company;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") return String(raw._id ?? "");
  return "";
}

export function companyNameOf(product: ShmpInventoryProduct) {
  const raw = product.company;
  if (raw && typeof raw === "object") {
    return companyLabel(raw);
  }
  return "";
}

export function storeIdOf(
  store: string | { _id?: string; storeName?: string } | undefined,
) {
  if (!store) return "";
  if (typeof store === "string") return store;
  return String(store._id ?? "");
}

export function storeNameOf(
  store: string | { _id?: string; storeName?: string } | undefined,
) {
  if (!store || typeof store === "string") return "";
  return String(store.storeName ?? "");
}

function asCategoryId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "_id" in (value as object)) {
    return String((value as { _id?: unknown })._id ?? "");
  }
  return "";
}

export function matchCategory(
  product: ShmpInventoryProduct,
  groups: CategoryGroup[],
) {
  const nested =
    typeof product.category === "object" && product.category
      ? product.category
      : null;
  const subId = asCategoryId(nested) || asCategoryId(product.category);
  const subName = String(nested?.subCategory ?? "");
  const masterHint = String(product.masterCategoryId ?? "");

  const same = (a?: string, b?: string) =>
    String(a || "")
      .trim()
      .toLowerCase() ===
    String(b || "")
      .trim()
      .toLowerCase();

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
        categoryName: group.name,
        subCategoryName: item.subCategory || "",
      };
    }
  }

  const group = groups.find(
    (entry) =>
      entry.masterCategoryId === masterHint || entry.name === masterHint,
  );
  if (group) {
    return {
      category: group.masterCategoryId || group.name,
      subCategory: subId,
      categoryName: group.name,
      subCategoryName: subName || subId,
    };
  }

  return {
    category: masterHint,
    subCategory: subId,
    categoryName: masterHint || subName,
    subCategoryName: subName || subId,
  };
}

export function formFromProduct(
  product: ShmpInventoryProduct,
  groups: CategoryGroup[],
): ProductFormState {
  const matched = matchCategory(product, groups);
  const ratio = Number(product.ratio ?? 1) || 1;
  const amountInUnits =
    (product.inQty?.amountInCartons ?? 0) * ratio +
    (product.inQty?.amountInUnits ?? 0);

  return {
    itemRef: String(product.itemRef ?? ""),
    itemName: String(product.itemName ?? ""),
    barCode: String(product.barCode ?? product.barcode ?? ""),
    baseItemCode: baseItemCodeOf(product),
    category: matched.category,
    subCategory: matched.subCategory,
    company: companyIdOf(product),
    unit: String(product.unit ?? "PCS"),
    ratio: String(product.ratio ?? 1),
    amountInUnits: String(amountInUnits),
    sellingPrice: String(product.sellingPrice ?? 0),
    isDisplay: Boolean(product.isDisplay ?? true),
    description: String(product.description ?? ""),
    dimensions: String(product.dimensions ?? ""),
    weight:
      product.weight != null && Number.isFinite(Number(product.weight))
        ? String(product.weight)
        : "",
    pricing: (product.storeProfileList || []).map((row, index) => ({
      key: `existing-${storeIdOf(row.store) || index}`,
      storeId: storeIdOf(row.store),
      storePrice: String(row.storePrice ?? product.sellingPrice ?? 0),
      storeItemCode: String(row.storeItemCode ?? ""),
    })),
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
      <FieldLabel label={label} required={required} />
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

function PricingEditor({
  pricing,
  stores,
  onChange,
}: {
  pricing: PricingRow[];
  stores: ShmpStore[];
  onChange: (rows: PricingRow[]) => void;
}) {
  const used = new Set(pricing.map((row) => row.storeId).filter(Boolean));

  function updateRow(key: string, patch: Partial<PricingRow>) {
    onChange(
      pricing.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-slate-700">
            Store pricing
          </p>
          <p className="text-xs text-slate-500">
            Add one or more store-specific prices. Base selling price is used
            when a store price is blank.
          </p>
        </div>
        <SecondaryButton
          type="button"
          onClick={() => onChange([...pricing, newPricingRow()])}
        >
          Add pricing
        </SecondaryButton>
      </div>

      {pricing.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-slate-500">
          No store prices yet. Click Add pricing to assign this product to
          stores.
        </p>
      ) : (
        <div className="space-y-3">
          {pricing.map((row) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-lg border border-line bg-[#f7f5f0]/40 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]"
            >
              <SelectField
                label="Store"
                required
                value={row.storeId}
                onChange={(value) => updateRow(row.key, { storeId: value })}
              >
                <option value="">Select store</option>
                {stores.map((store) => {
                  const taken =
                    used.has(store._id) && store._id !== row.storeId;
                  return (
                    <option
                      key={store._id}
                      value={store._id}
                      disabled={taken}
                    >
                      {store.storeName || store.uid || store._id}
                      {taken ? " (already added)" : ""}
                    </option>
                  );
                })}
              </SelectField>
              <TextField
                label="Store price"
                type="number"
                min={0}
                step="0.01"
                value={row.storePrice}
                onChange={(e) =>
                  updateRow(row.key, { storePrice: e.target.value })
                }
                placeholder="0.00"
              />
              <TextField
                label="Store item code"
                optional
                value={row.storeItemCode}
                onChange={(e) =>
                  updateRow(row.key, { storeItemCode: e.target.value })
                }
                placeholder="Optional"
              />
              <div className="flex items-end">
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() =>
                    onChange(pricing.filter((item) => item.key !== row.key))
                  }
                >
                  Remove
                </SecondaryButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function buildPayload(
  form: ProductFormState,
  groups: CategoryGroup[],
): Record<string, unknown> | { error: string } {
  const group =
    groups.find(
      (entry) =>
        entry.masterCategoryId === form.category || entry.name === form.category,
    ) || null;
  if (!group || !form.subCategory) {
    return { error: "Select a category and sub category" };
  }
  if (!form.company) return { error: "Select a company" };
  if (!form.itemRef.trim()) return { error: "Item ref is required" };
  if (!form.itemName.trim()) return { error: "Item name is required" };

  const storeProfiles: ShmpStoreProfileInput[] = [];
  const seen = new Set<string>();
  for (const row of form.pricing) {
    if (!row.storeId) {
      return { error: "Each pricing row needs a store" };
    }
    if (seen.has(row.storeId)) {
      return { error: "Duplicate store in pricing rows" };
    }
    seen.add(row.storeId);
    const price =
      row.storePrice.trim() === ""
        ? undefined
        : Number(row.storePrice);
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      return { error: "Store prices must be valid non-negative numbers" };
    }
    storeProfiles.push({
      storeId: row.storeId,
      storePrice: price,
      storeItemCode: row.storeItemCode.trim() || undefined,
      isDisplayed: true,
    });
  }

  const baseItemCode = form.baseItemCode.trim();

  return {
    itemRef: form.itemRef.trim(),
    baseItemCode: baseItemCode || undefined,
    itemCode: baseItemCode || undefined,
    itemName: form.itemName.trim(),
    barCode: form.barCode.trim(),
    barcode: form.barCode.trim(),
    masterCategoryId: group.masterCategoryId || undefined,
    category: form.subCategory,
    company: form.company,
    companyId: form.company,
    unit: form.unit.trim() || "PCS",
    ratio: Number(form.ratio) || 1,
    amountInUnits: Number(form.amountInUnits) || 0,
    sellingPrice: Number(form.sellingPrice) || 0,
    isDisplay: form.isDisplay,
    description: form.description.trim() || undefined,
    dimensions: form.dimensions.trim() || undefined,
    weight:
      form.weight.trim() === ""
        ? undefined
        : Number(form.weight),
    storeProfiles,
    source: SHMP_OWN_SOURCE,
    ownInventory: true,
  };
}

export function ProductFields({
  form,
  setForm,
  groups,
  companies,
  stores,
  loadingCategories,
  loadingCompanies,
}: {
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  groups: CategoryGroup[];
  companies: CompanyRecord[];
  stores: ShmpStore[];
  loadingCategories: boolean;
  loadingCompanies: boolean;
}) {
  const selectedGroup = useMemo(
    () =>
      groups.find(
        (group) =>
          group.masterCategoryId === form.category ||
          group.name === form.category,
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

  const formCompanies = useMemo(
    () => companies.filter((company) => !isStlCompanyLabel(company)),
    [companies],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TextField
        label="Item ref"
        required
        value={form.itemRef}
        onChange={(e) => setForm((prev) => ({ ...prev, itemRef: e.target.value }))}
      />
      <TextField
        label="Item name"
        required
        value={form.itemName}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, itemName: e.target.value }))
        }
      />
      <TextField
        label="Barcode"
        value={form.barCode}
        onChange={(e) => setForm((prev) => ({ ...prev, barCode: e.target.value }))}
      />
      <TextField
        label="Base item code"
        optional
        value={form.baseItemCode}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, baseItemCode: e.target.value }))
        }
      />
      <SelectField
        label="Category"
        required
        value={form.category}
        onChange={(value) =>
          setForm((prev) => ({ ...prev, category: value, subCategory: "" }))
        }
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
        onChange={(value) =>
          setForm((prev) => ({ ...prev, subCategory: value }))
        }
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
          <option value={form.subCategory}>Current sub category</option>
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
        onChange={(value) => setForm((prev) => ({ ...prev, company: value }))}
      >
        <option value="">
          {loadingCompanies ? "Loading companies…" : "Select company"}
        </option>
        {form.company &&
        !formCompanies.some((company) => company._id === form.company) ? (
          <option value={form.company}>Current company</option>
        ) : null}
        {formCompanies.map((company) => (
          <option key={company._id} value={company._id}>
            {companyLabel(company)}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Unit"
        required
        value={form.unit}
        onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
      />
      <TextField
        label="Ratio"
        required
        type="number"
        min={1}
        value={form.ratio}
        onChange={(e) => setForm((prev) => ({ ...prev, ratio: e.target.value }))}
      />
      <TextField
        label="Amount in units"
        required
        type="number"
        min={0}
        value={form.amountInUnits}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, amountInUnits: e.target.value }))
        }
      />
      <TextField
        label="Base selling price"
        required
        type="number"
        min={0}
        step="0.01"
        value={form.sellingPrice}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, sellingPrice: e.target.value }))
        }
      />
      <TextField
        label="Description"
        optional
        value={form.description}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, description: e.target.value }))
        }
      />
      <TextField
        label="Dimensions"
        optional
        value={form.dimensions}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, dimensions: e.target.value }))
        }
      />
      <TextField
        label="Weight"
        optional
        type="number"
        min={0}
        step="0.01"
        value={form.weight}
        onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))}
      />
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.isDisplay}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, isDisplay: e.target.checked }))
          }
        />
        Display in catalog
      </label>

      <div className="sm:col-span-2 lg:col-span-3">
        <PricingEditor
          pricing={form.pricing}
          stores={stores}
          onChange={(pricing) => setForm((prev) => ({ ...prev, pricing }))}
        />
      </div>
    </div>
  );
}

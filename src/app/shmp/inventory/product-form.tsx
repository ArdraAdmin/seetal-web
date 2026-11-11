"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { companyLabel, type CompanyRecord } from "@/lib/api";
import type { CategoryGroup } from "@/lib/categories";
import {
  baseItemCodeOf,
  isStlCompanyLabel,
  SHMP_OWN_SOURCE,
  type ShmpInventoryProduct,
  type ShmpStore,
} from "@/lib/shmp-api";
import { useAuth } from "@/components/AuthProvider";
import { portalFieldVisible } from "@/lib/custom-users";
import { FieldLabel, TextField } from "@/components/ui";
import {
  newStoreVisibilityRow,
  pricingRowsFromProfiles,
  storeProfilesFromRows,
  type StoreVisibilityRow,
} from "./store-visibility";

export type PricingRow = StoreVisibilityRow;

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
  cartonWeight: string;
  cartonDimensions: string;
  cbm: string;
  pieceWeight: string;
  pieceDimensions: string;
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
  cartonWeight: "",
  cartonDimensions: "",
  cbm: "",
  pieceWeight: "",
  pieceDimensions: "",
  pricing: [],
};

export function blankForm(company = ""): ProductFormState {
  return { ...EMPTY_FORM, company, pricing: [] };
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

function measureText(value: unknown) {
  if (value == null || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "";
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
  const matched = product.shmpCategoryId
    ? {
        category: String(product.shmpMasterCategory || ""),
        subCategory: String(product.shmpCategoryId),
      }
    : matchCategory(product, groups);
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
    cartonWeight: measureText(product.cartonWeight),
    cartonDimensions: String(product.cartonDimensions ?? ""),
    cbm: measureText(product.cbm),
    pieceWeight: measureText(product.pieceWeight ?? product.weight),
    pieceDimensions: String(product.pieceDimensions ?? product.dimensions ?? ""),
    pricing: pricingRowsFromProfiles(
      product.storeProfileList,
      product.sellingPrice,
    ),
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

function storeLabel(store: { storeName?: string; uid?: string; _id: string }) {
  return store.storeName || store.uid || store._id;
}

function StoreVisibilityEditor({
  pricing,
  stores,
  onChange,
  showPrice,
}: {
  pricing: PricingRow[];
  stores: ShmpStore[];
  onChange: (rows: PricingRow[]) => void;
  showPrice: boolean;
}) {
  const [filter, setFilter] = useState("");
  const knownIds = new Set(stores.map((store) => store._id));
  const selectedIds = new Set(
    pricing.map((row) => row.storeId).filter(Boolean),
  );
  const needle = filter.trim().toLowerCase();
  const listed = stores.filter((store) => {
    if (!needle) return true;
    const hay = `${store.storeName || ""} ${store.uid || ""} ${store.city || ""}`
      .toLowerCase();
    return hay.includes(needle);
  });
  const orphans = pricing.filter((row) => {
    if (!row.storeId || knownIds.has(row.storeId)) return false;
    if (!needle) return true;
    return `${row.storeName} ${row.storeId}`.toLowerCase().includes(needle);
  });

  function updateRow(storeId: string, patch: Partial<PricingRow>) {
    onChange(
      pricing.map((row) =>
        row.storeId === storeId ? { ...row, ...patch } : row,
      ),
    );
  }

  function setVisible(
    storeId: string,
    storeName: string,
    visible: boolean,
  ) {
    if (visible) {
      if (selectedIds.has(storeId)) return;
      onChange([...pricing, newStoreVisibilityRow(storeId, storeName)]);
      return;
    }
    onChange(pricing.filter((row) => row.storeId !== storeId));
  }

  function priceFields(row: PricingRow) {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {showPrice ? (
        <TextField
          label="Store price"
          optional
          type="number"
          min={0}
          step="0.01"
          value={row.storePrice}
          onChange={(e) =>
            updateRow(row.storeId, { storePrice: e.target.value })
          }
          placeholder="Uses base selling price"
        />
        ) : null}
        <TextField
          label="Store item code"
          optional
          value={row.storeItemCode}
          onChange={(e) =>
            updateRow(row.storeId, { storeItemCode: e.target.value })
          }
          placeholder="Optional"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[13px] font-medium text-slate-700">
          Store visibility
        </p>
        <p className="text-xs text-slate-500">
          Select the stores where this product is visible. Store price is
          optional. The base selling price is used when a store price is left
          blank.
        </p>
      </div>

      {stores.length === 0 && orphans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-slate-500">
          No SHMP stores yet. Add a store before choosing where this product
          is visible.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Visible in {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "store" : "stores"}
          </p>
          {stores.length > 5 ? (
            <TextField
              label="Find a store"
              optional
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Store name or code"
            />
          ) : null}
          {listed.length === 0 && orphans.length === 0 ? (
            <p className="text-sm text-slate-500">No stores match that search.</p>
          ) : null}
          {listed.map((store) => {
            const row = pricing.find((item) => item.storeId === store._id);
            const selected = Boolean(row);
            const name = storeLabel(store);
            return (
              <div
                key={store._id}
                className="rounded-lg border border-line bg-[#f7f5f0]/40 p-3"
              >
                <label className="flex items-start gap-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected}
                    onChange={(e) =>
                      setVisible(store._id, name, e.target.checked)
                    }
                  />
                  <span>
                    {name}
                    {store.city ? (
                      <span className="ml-2 font-normal text-slate-500">
                        {store.city}
                      </span>
                    ) : null}
                  </span>
                </label>
                {selected && row ? priceFields(row) : null}
              </div>
            );
          })}
          {orphans.map((row) => (
            <div
              key={row.key}
              className="rounded-lg border border-line bg-[#f7f5f0]/40 p-3"
            >
              <label className="flex items-start gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked
                  onChange={(e) =>
                    setVisible(
                      row.storeId,
                      row.storeName || row.storeId,
                      e.target.checked,
                    )
                  }
                />
                <span>{row.storeName || row.storeId}</span>
              </label>
              {priceFields(row)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type BuiltInventoryPayload =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

export function buildPayload(
  form: ProductFormState,
  groups: CategoryGroup[],
): BuiltInventoryPayload {
  const knownSub = groups.some((entry) =>
    entry.items.some((item) => (item._id || item.subCategory) === form.subCategory),
  );
  if (!form.subCategory || (groups.length > 0 && !knownSub)) {
    return { ok: false, error: "Select a category and sub category" };
  }
  if (!form.company) return { ok: false, error: "Select a company" };
  if (!form.itemRef.trim()) return { ok: false, error: "Item ref is required" };
  if (!form.itemName.trim()) return { ok: false, error: "Item name is required" };

  const profiles = storeProfilesFromRows(form.pricing);
  if (!profiles.ok) return profiles;
  const storeProfiles = profiles.profiles;

  const baseItemCode = form.baseItemCode.trim();

  return {
    ok: true,
    data: {
      itemRef: form.itemRef.trim(),
      baseItemCode: baseItemCode || undefined,
      itemCode: baseItemCode || undefined,
      itemName: form.itemName.trim(),
      barCode: form.barCode.trim(),
      barcode: form.barCode.trim(),
      shmpCategoryId: form.subCategory,
      company: form.company,
      companyId: form.company,
      unit: form.unit.trim() || "PCS",
      ratio: Number(form.ratio) || 1,
      amountInUnits: Number(form.amountInUnits) || 0,
      sellingPrice: Number(form.sellingPrice) || 0,
      isDisplay: form.isDisplay,
      description: form.description.trim() || undefined,
      cartonWeight: form.cartonWeight.trim() === "" ? "" : Number(form.cartonWeight),
      cartonDimensions: form.cartonDimensions.trim(),
      cbm: form.cbm.trim() === "" ? "" : Number(form.cbm),
      pieceWeight: form.pieceWeight.trim() === "" ? "" : Number(form.pieceWeight),
      pieceDimensions: form.pieceDimensions.trim(),
      storeProfiles,
      source: SHMP_OWN_SOURCE,
      ownInventory: true,
    },
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
  const { user } = useAuth();
  const showPrice = portalFieldVisible(user?.customAccess, "shmp", "inventory", "selling-price");
  const showQty = portalFieldVisible(user?.customAccess, "shmp", "inventory", "quantity");
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
      {showQty ? (
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
      ) : null}
      {showPrice ? (
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
      ) : null}
      <TextField
        label="Description"
        optional
        value={form.description}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, description: e.target.value }))
        }
      />
      <TextField
        label="Carton weight"
        optional
        type="number"
        min={0}
        step="0.01"
        value={form.cartonWeight}
        onChange={(e) => setForm((prev) => ({ ...prev, cartonWeight: e.target.value }))}
      />
      <TextField
        label="Carton dimensions"
        optional
        value={form.cartonDimensions}
        onChange={(e) => setForm((prev) => ({ ...prev, cartonDimensions: e.target.value }))}
        placeholder="L x W x H"
      />
      <TextField
        label="CBM"
        optional
        type="number"
        min={0}
        step="0.0001"
        value={form.cbm}
        onChange={(e) => setForm((prev) => ({ ...prev, cbm: e.target.value }))}
      />
      <TextField
        label="Piece weight"
        optional
        type="number"
        min={0}
        step="0.01"
        value={form.pieceWeight}
        onChange={(e) => setForm((prev) => ({ ...prev, pieceWeight: e.target.value }))}
      />
      <TextField
        label="Piece dimensions"
        optional
        value={form.pieceDimensions}
        onChange={(e) => setForm((prev) => ({ ...prev, pieceDimensions: e.target.value }))}
        placeholder="L x W x H"
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
        <StoreVisibilityEditor
          showPrice={showPrice}
          pricing={form.pricing}
          stores={stores}
          onChange={(pricing) => setForm((prev) => ({ ...prev, pricing }))}
        />
      </div>
    </div>
  );
}

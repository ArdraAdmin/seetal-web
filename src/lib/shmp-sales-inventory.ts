import type { Product } from "./types";

export type ShmpStoreProfileLike = {
  store?: unknown;
  storePrice?: unknown;
  isDisplayed?: unknown;
  storeItemCode?: unknown;
  storeImagePath?: unknown;
};

export type ShmpStoreInventoryDoc = {
  _id?: unknown;
  itemRef?: unknown;
  itemName?: unknown;
  barCode?: unknown;
  barcode?: unknown;
  unit?: unknown;
  ratio?: unknown;
  sellingPrice?: unknown;
  currentStorePrice?: unknown;
  isDisplay?: unknown;
  inQty?: { amountInCartons?: unknown; amountInUnits?: unknown };
  amountInCartons?: unknown;
  amountInUnits?: unknown;
  category?: unknown;
  categoryId?: unknown;
  subCategoryId?: unknown;
  masterCategoryId?: unknown;
  masterCategoryName?: unknown;
  imagePath?: unknown;
  company?: unknown;
  storeProfileList?: ShmpStoreProfileLike[];
  storeItemCode?: unknown;
};

function idString(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object" && "_id" in value) {
    return String((value as { _id?: unknown })._id ?? "").trim();
  }
  if (typeof value === "object" && "toHexString" in value) {
    return String(
      (value as { toHexString: () => string }).toHexString(),
    ).trim();
  }
  return String(value).trim();
}

export function sameStoreId(left: unknown, right: string) {
  const wanted = right.trim();
  if (!wanted) return false;
  return idString(left) === wanted;
}

export function matchingStoreProfile(
  list: ShmpStoreProfileLike[] | undefined,
  storeId: string,
): ShmpStoreProfileLike | null {
  if (!Array.isArray(list) || !storeId.trim()) return null;
  return (
    list.find((row) => sameStoreId(row?.store, storeId)) || null
  );
}

export function isDisplayedStoreProfile(profile: ShmpStoreProfileLike | null) {
  if (!profile) return false;
  return profile.isDisplayed !== false;
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function imageUrl(value: unknown) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function companyValue(value: unknown): Product["company"] {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as { _id?: unknown; name?: unknown; prefix?: unknown };
    const id = idString(row._id);
    if (!id && !row.name && !row.prefix) return undefined;
    return {
      _id: id || undefined,
      name: row.name ? String(row.name) : undefined,
      prefix: row.prefix ? String(row.prefix) : undefined,
    };
  }
  return undefined;
}

function categoryValue(value: unknown): Product["category"] {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const row = value as {
      _id?: unknown;
      subCategory?: unknown;
      masterCategory?: unknown;
      masterCategoryName?: unknown;
      masterCategoryId?: unknown;
    };
    const mapped = {
      _id: idString(row._id) || undefined,
      subCategory: row.subCategory ? String(row.subCategory) : undefined,
      masterCategory: row.masterCategory
        ? String(row.masterCategory)
        : row.masterCategoryName
          ? String(row.masterCategoryName)
          : undefined,
      masterCategoryId: row.masterCategoryId
        ? String(row.masterCategoryId)
        : undefined,
    };
    if (row.masterCategoryName) {
      (mapped as { masterCategoryName?: string }).masterCategoryName =
        String(row.masterCategoryName);
    }
    return mapped;
  }
  return undefined;
}

export function productFromShmpStoreDoc(
  doc: ShmpStoreInventoryDoc,
  storeId: string,
): Product | null {
  const id = idString(doc._id);
  if (!id) return null;
  const profile = matchingStoreProfile(doc.storeProfileList, storeId);
  if (!isDisplayedStoreProfile(profile)) return null;

  const sellingPrice = asNumber(doc.sellingPrice);
  const storePrice = asNumber(profile?.storePrice, sellingPrice);
  const category = categoryValue(doc.category);
  const categoryId =
    idString(doc.categoryId) ||
    (typeof category === "object" ? String(category._id || "") : "") ||
    (typeof category === "string" ? category : "");
  const imagePath =
    imageUrl(profile?.storeImagePath) ||
    imageUrl(doc.imagePath) ||
    String(doc.imagePath || profile?.storeImagePath || "") ||
    undefined;

  return {
    _id: id,
    itemRef: doc.itemRef ? String(doc.itemRef) : undefined,
    itemName: doc.itemName ? String(doc.itemName) : undefined,
    barCode: doc.barCode ? String(doc.barCode) : undefined,
    barcode: doc.barcode ? String(doc.barcode) : undefined,
    unit: doc.unit ? String(doc.unit) : undefined,
    ratio: asNumber(doc.ratio, 1),
    sellingPrice: storePrice || sellingPrice,
    currentStorePrice: storePrice || sellingPrice,
    isDisplay: doc.isDisplay !== false,
    inQty: {
      amountInCartons: asNumber(doc.inQty?.amountInCartons ?? doc.amountInCartons),
      amountInUnits: asNumber(doc.inQty?.amountInUnits ?? doc.amountInUnits),
    },
    category,
    categoryId: categoryId || undefined,
    subCategoryId: doc.subCategoryId ? String(doc.subCategoryId) : undefined,
    masterCategoryId: doc.masterCategoryId
      ? String(doc.masterCategoryId)
      : typeof category === "object"
        ? category.masterCategoryId
        : undefined,
    masterCategoryName:
      doc.masterCategoryName
        ? String(doc.masterCategoryName)
        : typeof category === "object"
          ? String(
              (category as { masterCategoryName?: string }).masterCategoryName ||
                category.masterCategory ||
                "",
            ) || undefined
          : undefined,
    imagePath,
    company: companyValue(doc.company),
    storeItemCode: profile?.storeItemCode
      ? String(profile.storeItemCode)
      : doc.storeItemCode
        ? String(doc.storeItemCode)
        : undefined,
  };
}

export function filterShmpSalesInventory(
  products: Product[],
  tag = "",
  cat = "",
  subCat = "",
) {
  const needle = tag.trim().toLowerCase();
  const category = cat.trim();
  const sub = subCat.trim().toLowerCase();
  if (!needle && !category && !sub) return products;

  return products.filter((product) => {
    if (needle) {
      const hay = [
        product.itemName,
        product.itemRef,
        product.barCode,
        product.barcode,
        product.storeItemCode,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      if (!hay.includes(needle)) return false;
    }
    if (category) {
      const values = [
        product.masterCategoryId,
        product.masterCategoryName,
        typeof product.category === "object"
          ? product.category?.masterCategoryId
          : "",
        typeof product.category === "object"
          ? (product.category as { masterCategoryName?: string })
              ?.masterCategoryName || product.category?.masterCategory
          : "",
      ].map((value) => String(value || ""));
      if (!values.includes(category)) return false;
    }
    if (sub) {
      const subName =
        typeof product.category === "object"
          ? String(product.category?.subCategory || "").toLowerCase()
          : "";
      const subId =
        typeof product.category === "object"
          ? String(product.category?._id || "").toLowerCase()
          : String(product.categoryId || product.subCategoryId || "").toLowerCase();
      if (subName !== sub && subId !== sub) return false;
    }
    return true;
  });
}

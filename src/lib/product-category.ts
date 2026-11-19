import type { Product } from "./types";

/** Manufacturing / SHMP own-inventory SKUs (not STL/Sarvah/SH Lakshmi catalogue). */
export function isShmpManufacturingProduct(product: Product) {
  if (product.ownInventory === true) return true;
  if (String(product.source || "").trim() === "shmp-production") return true;
  if (String(product.shmpCategoryId || "").trim()) return true;
  if (String(product.shmpMasterCategory || "").trim()) return true;
  return false;
}

function classicProductCategoryId(product: Product) {
  if (typeof product.category === "object" && product.category?._id) {
    return String(product.category._id);
  }
  if (typeof product.category === "string" && product.category) {
    return product.category;
  }
  return String(product.categoryId || product.subCategoryId || "");
}

/**
 * Category id for cart / order lines.
 * SHMP manufacturing products may use shmpCategoryId (or a master-only cart
 * token). Other companies still require classic STL Category ids only.
 */
export function productCategoryId(product: Product) {
  const classic = classicProductCategoryId(product);
  if (classic) return classic;
  if (!isShmpManufacturingProduct(product)) return "";
  const shmpId = String(product.shmpCategoryId || "").trim();
  if (shmpId) return shmpId;
  const master = String(product.shmpMasterCategory || "").trim();
  // Client-only token for master-named SHMP rows without a subcategory ObjectId.
  return master ? `shmp-master:${master}` : "";
}

export function productMasterCategoryId(product: Product) {
  if (product.masterCategoryId) return String(product.masterCategoryId);
  if (
    typeof product.category === "object" &&
    product.category?.masterCategoryId
  ) {
    return String(product.category.masterCategoryId);
  }
  if (isShmpManufacturingProduct(product)) {
    // SHMP creates stamp warehouse master code 0005 (Miscellaneous).
    return "0005";
  }
  return "";
}

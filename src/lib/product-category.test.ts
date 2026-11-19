import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isShmpManufacturingProduct,
  productCategoryId,
  productMasterCategoryId,
} from "./product-category.ts";
import type { Product } from "./types.ts";

describe("SHMP manufacturing category for sales cart", () => {
  const stlBare: Product = {
    _id: "stl1",
    itemName: "STL bowl",
    sellingPrice: 10,
  };

  const shmpWithSub: Product = {
    _id: "shmp1",
    itemName: "SHMP box",
    sellingPrice: 12,
    ownInventory: true,
    source: "shmp-production",
    shmpCategoryId: "64d0000000000000000000dd",
    shmpMasterCategory: "Packaging",
    masterCategoryId: "0005",
  };

  const shmpMasterOnly: Product = {
    _id: "shmp2",
    itemName: "SHMP master only",
    sellingPrice: 8,
    source: "shmp-production",
    shmpMasterCategory: "Packaging",
  };

  it("detects manufacturing products", () => {
    assert.equal(isShmpManufacturingProduct(stlBare), false);
    assert.equal(isShmpManufacturingProduct(shmpWithSub), true);
    assert.equal(isShmpManufacturingProduct(shmpMasterOnly), true);
  });

  it("still blocks STL products without a classic category", () => {
    assert.equal(productCategoryId(stlBare), "");
  });

  it("accepts SHMP subcategory ids for the cart", () => {
    assert.equal(productCategoryId(shmpWithSub), "64d0000000000000000000dd");
    assert.equal(productMasterCategoryId(shmpWithSub), "0005");
  });

  it("accepts SHMP master-only products with a cart token", () => {
    assert.equal(productCategoryId(shmpMasterOnly), "shmp-master:Packaging");
    assert.equal(productMasterCategoryId(shmpMasterOnly), "0005");
  });

  it("prefers classic category when both are present", () => {
    const mixed: Product = {
      ...shmpWithSub,
      category: { _id: "64c0000000000000000000cc", masterCategoryId: "0002" },
    };
    assert.equal(productCategoryId(mixed), "64c0000000000000000000cc");
  });
});

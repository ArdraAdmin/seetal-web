import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterShmpSalesInventory,
  matchingStoreProfile,
  productFromShmpStoreDoc,
} from "./shmp-sales-inventory.ts";

const storeId = "64a000000000000000000001";

const assignedDoc = {
  _id: "64b0000000000000000000aa",
  itemRef: "SHMP-1",
  itemName: "SHMP tile",
  unit: "PCS",
  ratio: 12,
  sellingPrice: 40,
  masterCategoryId: "0002",
  masterCategoryName: "Crockery",
  category: {
    _id: "64c0000000000000000000cc",
    subCategory: "Tiles",
    masterCategoryName: "Crockery",
    masterCategoryId: "0002",
  },
  company: { _id: "670d5f6a2c6a53f39f7a0fcf", name: "SHMP" },
  inQty: { amountInCartons: 3, amountInUnits: 8 },
  storeProfileList: [
    {
      store: storeId,
      storePrice: 55,
      isDisplayed: true,
      storeItemCode: "DEMO-1",
    },
    {
      store: "64a000000000000000000099",
      storePrice: 90,
      isDisplayed: true,
    },
  ],
};

describe("productFromShmpStoreDoc", () => {
  it("maps the matching store overlay and ignores other stores", () => {
    const product = productFromShmpStoreDoc(assignedDoc, storeId);
    assert.equal(product?._id, "64b0000000000000000000aa");
    assert.equal(product?.itemName, "SHMP tile");
    assert.equal(product?.currentStorePrice, 55);
    assert.equal(product?.sellingPrice, 55);
    assert.equal(product?.storeItemCode, "DEMO-1");
    assert.equal(product?.categoryId, "64c0000000000000000000cc");
    assert.equal(product?.inQty?.amountInCartons, 3);
  });

  it("hides products that are not assigned or not displayed", () => {
    assert.equal(
      productFromShmpStoreDoc(assignedDoc, "64a000000000000000000777"),
      null,
    );
    assert.equal(
      productFromShmpStoreDoc(
        {
          ...assignedDoc,
          storeProfileList: [
            { store: storeId, storePrice: 55, isDisplayed: false },
          ],
        },
        storeId,
      ),
      null,
    );
  });

  it("matches populated store objects", () => {
    const profile = matchingStoreProfile(
      [{ store: { _id: storeId }, storePrice: 10, isDisplayed: true }],
      storeId,
    );
    assert.equal(profile?.storePrice, 10);
  });
});

describe("filterShmpSalesInventory", () => {
  const products = [
    productFromShmpStoreDoc(assignedDoc, storeId)!,
    productFromShmpStoreDoc(
      {
        ...assignedDoc,
        _id: "64b0000000000000000000bb",
        itemName: "Basin",
        itemRef: "SHMP-2",
        masterCategoryName: "Sanitaryware",
        category: {
          _id: "64c0000000000000000000dd",
          subCategory: "Basins",
          masterCategoryName: "Sanitaryware",
          masterCategoryId: "0005",
        },
        storeProfileList: [
          { store: storeId, storePrice: 20, isDisplayed: true },
        ],
      },
      storeId,
    )!,
  ];

  it("filters by name, item code, and store item code", () => {
    assert.equal(filterShmpSalesInventory(products, "tile").length, 1);
    assert.equal(filterShmpSalesInventory(products, "DEMO-1").length, 1);
    assert.equal(filterShmpSalesInventory(products, "missing").length, 0);
  });

  it("filters by category and subcategory", () => {
    assert.equal(
      filterShmpSalesInventory(products, "", "Crockery").length,
      1,
    );
    assert.equal(
      filterShmpSalesInventory(products, "", "Crockery", "tiles").length,
      1,
    );
    assert.equal(
      filterShmpSalesInventory(products, "", "Crockery", "basins").length,
      0,
    );
  });
});

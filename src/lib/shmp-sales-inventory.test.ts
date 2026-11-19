import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterShmpSalesInventory,
  matchingStoreProfile,
  pageShmpAssignedInventory,
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
  shmpCategoryId: "64d0000000000000000000dd",
  shmpMasterCategory: "Packaging",
  shmpSubCategory: "Boxes",
  source: "shmp-production",
  ownInventory: true,
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
    assert.equal(product?.shmpCategoryId, "64d0000000000000000000dd");
    assert.equal(product?.shmpMasterCategory, "Packaging");
    assert.equal(product?.shmpSubCategory, "Boxes");
    assert.equal(product?.source, "shmp-production");
    assert.equal(product?.ownInventory, true);
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

  it("uses the first gallery image as the sales thumbnail", () => {
    const product = productFromShmpStoreDoc(
      {
        ...assignedDoc,
        imagePath: [
          "https://cdn.example/primary.jpg",
          "https://cdn.example/second.jpg",
        ],
      },
      storeId,
    );
    assert.equal(product?.imagePath, "https://cdn.example/primary.jpg");
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

describe("pageShmpAssignedInventory", () => {
  const manufacturing = [
    productFromShmpStoreDoc(assignedDoc, storeId)!,
    productFromShmpStoreDoc(
      {
        ...assignedDoc,
        _id: "64b0000000000000000000bb",
        itemName: "Basin",
        itemRef: "SH-SB-35",
        inQty: { amountInCartons: 0, amountInUnits: 0 },
        storeProfileList: [
          { store: storeId, storePrice: 12.75, isDisplayed: true },
        ],
      },
      storeId,
    )!,
    productFromShmpStoreDoc(
      {
        ...assignedDoc,
        _id: "64b0000000000000000000cc",
        itemName: "Mug",
        itemRef: "SHMP-3",
        inQty: { amountInCartons: 5, amountInUnits: 0 },
        storeProfileList: [
          { store: storeId, storePrice: 8, isDisplayed: true },
        ],
      },
      storeId,
    )!,
  ];

  it("pages assigned manufacturing products without changing stock", () => {
    const page1 = pageShmpAssignedInventory(manufacturing, 1, 2);
    assert.equal(page1.products.length, 2);
    assert.equal(page1.hasNext, true);
    assert.equal(page1.products[0]?.inQty?.amountInCartons, 3);
    assert.equal(page1.products[1]?.itemRef, "SH-SB-35");
    assert.equal(page1.products[1]?.inQty?.amountInCartons, 0);

    const page2 = pageShmpAssignedInventory(manufacturing, 2, 2);
    assert.equal(page2.products.length, 1);
    assert.equal(page2.hasNext, false);
    assert.equal(page2.products[0]?.itemRef, "SHMP-3");
  });

  it("keeps manufacturing qty when filtering by a shared selling item code", () => {
    const page = pageShmpAssignedInventory(manufacturing, 1, 30, "SH-SB-35");
    assert.equal(page.products.length, 1);
    assert.equal(page.products[0]?.itemRef, "SH-SB-35");
    // Must stay manufacturing stock (0), not a Sarvah selling twin (e.g. 119).
    assert.equal(page.products[0]?.inQty?.amountInCartons, 0);
    assert.equal(page.products[0]?.sellingPrice, 12.75);
  });
});

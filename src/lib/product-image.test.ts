import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_PRODUCT_IMAGES,
  productBelongsToCompany,
  productImageUrl,
  productImageUrls,
  remainingProductImageSlots,
} from "./product-image.ts";

describe("product image display", () => {
  it("shows only http image urls", () => {
    assert.equal(productImageUrl("catalog/item"), "");
    assert.equal(
      productImageUrl("https://cdn.example/item.jpg"),
      "https://cdn.example/item.jpg",
    );
  });

  it("uses the first gallery image as the thumbnail", () => {
    assert.equal(
      productImageUrl([
        "https://cdn.example/a.jpg",
        "https://cdn.example/b.jpg",
      ]),
      "https://cdn.example/a.jpg",
    );
    assert.equal(
      productImageUrl(["catalog/item", "https://cdn.example/b.jpg"]),
      "",
    );
    assert.deepEqual(
      productImageUrls([
        "https://cdn.example/a.jpg",
        "catalog/item",
        "https://cdn.example/b.jpg",
      ]),
      ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    );
    assert.equal(MAX_PRODUCT_IMAGES, 5);
    assert.equal(
      remainingProductImageSlots([
        "https://cdn.example/a.jpg",
        "https://cdn.example/b.jpg",
      ]),
      3,
    );
  });

  it("matches a product to the selected company id", () => {
    assert.equal(productBelongsToCompany("abc", "abc"), true);
    assert.equal(productBelongsToCompany({ _id: "abc" }, "abc"), true);
    assert.equal(productBelongsToCompany({ _id: "shmp" }, "abc"), false);
    assert.equal(productBelongsToCompany(undefined, "abc"), false);
  });
});

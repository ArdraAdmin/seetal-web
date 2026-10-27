import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { productBelongsToCompany, productImageUrl } from "./product-image.ts";

describe("product image display", () => {
  it("shows only http image urls", () => {
    assert.equal(productImageUrl("catalog/item"), "");
    assert.equal(
      productImageUrl("https://cdn.example/item.jpg"),
      "https://cdn.example/item.jpg",
    );
    assert.equal(
      productImageUrl(["catalog/item", "https://cdn.example/b.jpg"]),
      "https://cdn.example/b.jpg",
    );
  });

  it("matches a product to the selected company id", () => {
    assert.equal(productBelongsToCompany("abc", "abc"), true);
    assert.equal(productBelongsToCompany({ _id: "abc" }, "abc"), true);
    assert.equal(productBelongsToCompany({ _id: "shmp" }, "abc"), false);
    assert.equal(productBelongsToCompany(undefined, "abc"), false);
  });
});

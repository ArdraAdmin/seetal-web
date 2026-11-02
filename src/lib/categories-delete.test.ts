import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTS_LINKED_MESSAGE,
  productIsLinkedToCategory,
} from "./categories.ts";

const ceramic = "620a4774811ba35d4de70dfb";

describe("productIsLinkedToCategory", () => {
  it("matches a product on the master category id", () => {
    assert.equal(
      productIsLinkedToCategory(
        { masterCategoryId: "0002", category: "someone-else" },
        { categoryIds: [ceramic], masterCategoryId: "0002" },
      ),
      true,
    );
  });

  it("matches a product whose category is a subcategory id", () => {
    assert.equal(
      productIsLinkedToCategory(
        { category: ceramic, masterCategoryId: "0099" },
        { categoryIds: [ceramic], masterCategoryId: "0002" },
      ),
      true,
    );
  });

  it("matches a category object id and a subcategory id field", () => {
    assert.equal(
      productIsLinkedToCategory(
        { category: { _id: ceramic } },
        { categoryIds: [ceramic], masterCategoryId: "0002" },
      ),
      true,
    );
    assert.equal(
      productIsLinkedToCategory(
        { subCategoryId: ceramic },
        { categoryIds: [ceramic] },
      ),
      true,
    );
  });

  it("does not block a subcategory delete when a product only names the master", () => {
    assert.equal(
      productIsLinkedToCategory(
        { masterCategoryId: "0002" },
        { categoryIds: [ceramic] },
      ),
      false,
    );
  });

  it("does not treat an unrelated product as linked", () => {
    assert.equal(
      productIsLinkedToCategory(
        { category: "other", masterCategoryId: "0003" },
        { categoryIds: [ceramic], masterCategoryId: "0002" },
      ),
      false,
    );
  });

  it("does not match every product when the category has no ids", () => {
    assert.equal(
      productIsLinkedToCategory(
        { category: ceramic, masterCategoryId: "0002" },
        { categoryIds: [], masterCategoryId: " " },
      ),
      false,
    );
  });

  it("uses a message that says products are linked", () => {
    assert.match(PRODUCTS_LINKED_MESSAGE, /products are linked/i);
  });
});

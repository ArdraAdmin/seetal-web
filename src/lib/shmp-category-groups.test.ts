import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CategoryGroup } from "./categories.ts";
import {
  filterCategoryGroups,
  shmpCategoryGroups,
} from "./shmp-category-groups.ts";

function group(
  name: string,
  subs: string[],
): CategoryGroup {
  return {
    name,
    masterCategoryId: name,
    awsMasterCatDir: "",
    items: subs.map((subCategory, index) => ({
      _id: `${name}-${index}`,
      subCategory,
    })),
  };
}

const groups = [
  group("Packaging", ["Cartons", "Labels"]),
  group("Raw material", ["Film"]),
];

describe("shmpCategoryGroups", () => {
  it("groups rows that share a category and sorts the groups", () => {
    const grouped = shmpCategoryGroups([
      { _id: "2", masterCategoryName: "Raw material", subCategory: "Film" },
      { _id: "1", masterCategoryName: "Packaging", subCategory: "Cartons" },
      { _id: "3", masterCategoryName: "Packaging", subCategory: "Labels" },
    ]);
    assert.deepEqual(
      grouped.map((group) => group.name),
      ["Packaging", "Raw material"],
    );
    assert.deepEqual(
      grouped[0]?.items.map((item) => item.subCategory),
      ["Cartons", "Labels"],
    );
  });

  it("uses a fallback name when the category is blank", () => {
    const grouped = shmpCategoryGroups([{ _id: "1", subCategory: "Misc" }]);
    assert.equal(grouped[0]?.name, "Category");
    assert.equal(grouped[0]?.items[0]?.subCategory, "Misc");
  });
});

describe("filterCategoryGroups", () => {
  it("returns every group when the search is empty", () => {
    assert.deepEqual(filterCategoryGroups(groups, "   "), groups);
  });

  it("keeps a whole group when the category name matches", () => {
    assert.deepEqual(filterCategoryGroups(groups, "pack"), [groups[0]]);
  });

  it("keeps only the matching subcategory when the category name does not match", () => {
    const found = filterCategoryGroups(groups, "label");
    assert.equal(found.length, 1);
    assert.equal(found[0]?.name, "Packaging");
    assert.deepEqual(
      found[0]?.items.map((item) => item.subCategory),
      ["Labels"],
    );
  });

  it("returns nothing when nothing matches", () => {
    assert.deepEqual(filterCategoryGroups(groups, "glass"), []);
  });
});

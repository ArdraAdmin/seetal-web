import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categoryCompany,
  filterCategoryGroupsByCompany,
  mergeCategoryGroups,
  type CategoryGroup,
} from "./categories.ts";

const crockery: CategoryGroup = {
  name: "Crockery",
  masterCategoryId: "0002",
  awsMasterCatDir: "Crockery",
  items: [
    { _id: "sub-stl", subCategory: "Trays" },
    { _id: "sub-sarvah", subCategory: "Mugs", company: "sarvah" },
  ],
};

describe("categoryCompany", () => {
  it("treats a missing company as STL", () => {
    assert.equal(categoryCompany(undefined), "stl");
    assert.equal(categoryCompany(""), "stl");
  });
});

describe("mergeCategoryGroups", () => {
  it("keeps a main category that has no subcategories and marks it STL", () => {
    const merged = mergeCategoryGroups(
      [],
      [{ masterCategoryId: "0009", masterCategoryName: "New line" }],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.name, "New line");
    assert.equal(merged[0]?.company, "stl");
    assert.deepEqual(merged[0]?.items, []);
  });

  it("uses the main category company and defaults each subcategory", () => {
    const merged = mergeCategoryGroups([crockery], [
      {
        masterCategoryId: "0002",
        masterCategoryName: "Crockery",
        company: "shlaxmi",
      },
    ]);
    assert.equal(merged[0]?.company, "shlaxmi");
    assert.equal(merged[0]?.items[0]?.company, "stl");
    assert.equal(merged[0]?.items[1]?.company, "sarvah");
  });
});

describe("filterCategoryGroupsByCompany", () => {
  it("shows every category when no company is selected", () => {
    const merged = mergeCategoryGroups([crockery], [
      { masterCategoryId: "0002", masterCategoryName: "Crockery", company: "stl" },
    ]);
    assert.equal(filterCategoryGroupsByCompany(merged, null).length, 1);
    assert.equal(filterCategoryGroupsByCompany(merged, null)[0]?.items.length, 2);
  });

  it("shows STL categories and only STL subcategories", () => {
    const merged = mergeCategoryGroups([crockery], [
      { masterCategoryId: "0002", masterCategoryName: "Crockery" },
    ]);
    const visible = filterCategoryGroupsByCompany(merged, "stl");
    assert.equal(visible.length, 1);
    assert.deepEqual(
      visible[0]?.items.map((item) => item.subCategory),
      ["Trays"],
    );
  });

  it("shows a parent on Sarvah when one subcategory belongs to Sarvah", () => {
    const merged = mergeCategoryGroups([crockery], [
      { masterCategoryId: "0002", masterCategoryName: "Crockery", company: "stl" },
    ]);
    const visible = filterCategoryGroupsByCompany(merged, "sarvah");
    assert.equal(visible.length, 1);
    assert.deepEqual(
      visible[0]?.items.map((item) => item.subCategory),
      ["Mugs"],
    );
  });

  it("hides a company that has neither the parent nor a subcategory", () => {
    const merged = mergeCategoryGroups([crockery], [
      { masterCategoryId: "0002", masterCategoryName: "Crockery", company: "stl" },
    ]);
    assert.deepEqual(filterCategoryGroupsByCompany(merged, "shlaxmi"), []);
  });
});

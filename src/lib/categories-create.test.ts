import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCreateSubCategoryBody } from "./categories.ts";

describe("buildCreateSubCategoryBody", () => {
  it("includes the master category name the API requires", () => {
    assert.deepEqual(
      buildCreateSubCategoryBody({
        masterCategoryId: " 0002 ",
        masterCategoryName: " Crockery and Disposables ",
        subCategory: " Demo ",
        awsMasterCatDir: " CrockeryAndDisposables ",
      }),
      {
        masterCategoryId: "0002",
        masterCategoryName: "Crockery and Disposables",
        subCategory: "Demo",
        awsMasterCatDir: "CrockeryAndDisposables",
        awsSubCatDir: "demo",
      },
    );
  });

  it("builds the stored folder name from letters and numbers", () => {
    const body = buildCreateSubCategoryBody({
      masterCategoryId: "0002",
      masterCategoryName: "Crockery and Disposables",
      subCategory: "Cutlery / Disposables",
      awsMasterCatDir: "CrockeryAndDisposables",
    });
    assert.equal(body.awsSubCatDir, "cutlerydisposables");
  });
});

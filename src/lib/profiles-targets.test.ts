import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shmpCompanyId, stlCompanyId } from "./profiles.ts";

describe("sales target company helpers", () => {
  const companies = [
    { _id: "stl-1", name: "STL", prefix: "STL" },
    { _id: "shmp-1", name: "SHMP", prefix: "SHMP" },
    { _id: "sarvah-1", name: "Sarvah", prefix: "SAR" },
  ];

  it("resolves STL and SHMP company ids", () => {
    assert.equal(stlCompanyId(companies), "stl-1");
    assert.equal(shmpCompanyId(companies), "shmp-1");
  });

  it("resolves SHMP from prefix when name differs", () => {
    assert.equal(
      shmpCompanyId([{ _id: "x", name: "Factory", prefix: "SHMP" }]),
      "x",
    );
  });

  it("returns empty when SHMP is missing", () => {
    assert.equal(shmpCompanyId([{ _id: "stl-1", name: "STL" }]), "");
  });
});

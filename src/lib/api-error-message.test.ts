import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeApiError } from "./api-error-message.ts";

describe("describeApiError", () => {
  it("keeps a plain string", () => {
    assert.equal(describeApiError("Store not found", "fallback"), "Store not found");
  });

  it("reads a string error field", () => {
    assert.equal(
      describeApiError({ error: "Store not found" }, "fallback"),
      "Store not found",
    );
  });

  it("reads a nested error message instead of [object Object]", () => {
    assert.equal(
      describeApiError({ error: { message: "Not found" } }, "fallback"),
      "Not found",
    );
  });

  it("reads a top-level message", () => {
    assert.equal(
      describeApiError({ message: "Unable to update store" }, "fallback"),
      "Unable to update store",
    );
  });

  it("reads a validation name", () => {
    assert.equal(
      describeApiError({ name: "Sales person doesnt exist." }, "fallback"),
      "Sales person doesnt exist.",
    );
  });

  it("uses the fallback when the body has no message", () => {
    assert.equal(describeApiError({ error: {} }, "Could not update store"), "Could not update store");
    assert.equal(describeApiError(null, "Could not update store"), "Could not update store");
    assert.equal(describeApiError("[object Object]", "Could not update store"), "Could not update store");
  });
});

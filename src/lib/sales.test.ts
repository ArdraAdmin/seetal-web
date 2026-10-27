import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactMoney, salesMoney } from "./sales.ts";

describe("compactMoney", () => {
  it("keeps small amounts at full precision", () => {
    assert.equal(compactMoney(0), "AED 0.00");
    assert.equal(compactMoney(2563.82), salesMoney(2563.82));
    assert.equal(compactMoney(9999.99), salesMoney(9999.99));
  });

  it("abbreviates thousands, millions, and billions", () => {
    assert.equal(compactMoney(10_000), "AED 10.0K");
    assert.equal(compactMoney(275_328.37), "AED 275.3K");
    assert.equal(compactMoney(64_983_416.19), "AED 65.0M");
    assert.equal(compactMoney(1_000_000), "AED 1.0M");
    assert.equal(compactMoney(2_500_000_000), "AED 2.5B");
  });

  it("preserves the minus sign on compact figures", () => {
    assert.equal(compactMoney(-64_983_416.19), "AED -65.0M");
    assert.equal(compactMoney(-12_500), "AED -12.5K");
  });

  it("treats non-finite values as zero", () => {
    assert.equal(compactMoney(Number.NaN), "AED 0.00");
    assert.equal(compactMoney(Number.POSITIVE_INFINITY), "AED 0.00");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectableAmount,
  grvRemarkNote,
  paymentActions,
  remainingAmount,
} from "./invoice.ts";
import type { PaymentRecord, PdcRecord } from "./types.ts";

function pdc(cheque: Date): PdcRecord {
  return { _id: "pdc-1", chequeDate: cheque.toISOString(), amount: 80 };
}

describe("GRV collectable amount", () => {
  it("reduces an invoice by the GRV remark when line quantities are absent", () => {
    const payments: PaymentRecord[] = [
      {
        _id: "pay-1",
        note: grvRemarkNote(20),
        amountPaid: 0,
      },
    ];
    const order = { totalCost: 100, productDetails: [] };
    assert.equal(collectableAmount(order, payments), 80);
    assert.equal(remainingAmount(order, payments), 80);
  });

  it("uses returned line value ahead of the remark", () => {
    const order = {
      totalCost: 100,
      productDetails: [
        {
          storeCost: 20,
          quantityAv: 1,
          unitAv: "PCS",
          grv: { isGRV: true, grvQty: 1, grvUnit: "PCS" },
          product: { ratio: 1 },
        },
      ],
    };
    assert.equal(collectableAmount(order), 80);
  });
});

describe("PDC payment actions", () => {
  const september3 = new Date(2026, 8, 3, 9, 0, 0);
  const september15 = new Date(2026, 8, 15, 9, 0, 0);
  const cheque = pdc(new Date(2026, 8, 15));

  it("hides completion and clear payment before the cheque date", () => {
    assert.deepEqual(
      paymentActions({ remaining: 80, pdc: cheque, today: september3 }),
      { canComplete: false, canClear: false },
    );
  });

  it("shows clear payment on the cheque date and keeps mark completed hidden", () => {
    assert.deepEqual(
      paymentActions({ remaining: 80, pdc: cheque, today: september15 }),
      { canComplete: false, canClear: true },
    );
  });

  it("offers mark completed when no cheque is on file", () => {
    assert.deepEqual(
      paymentActions({ remaining: 80, pdc: null, today: september3 }),
      { canComplete: true, canClear: false },
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addProductToShmpEditLines,
  buildShmpEditTempOrderPayload,
  packedQtyPayload,
  ratioFromApprovalLine,
  shmpEditCartTotals,
  shmpEditLinesFromDetail,
  shmpOrderSectionFromDetail,
  updateShmpEditLine,
  validateShmpEditLines,
} from "./shmp-order-edit.ts";
import type { ApprovalOrder } from "./types.ts";

const order = {
  _id: "ord1",
  tempOrderInvoiceNo: "shmp/pratham/0006",
  status: "InProduction",
  sales: { _id: "sales1", name: "Sam" },
  store: { _id: "store1", storeName: "Al Ain" },
  isTempStore: false,
  isVat: true,
  invoiceType: "ld",
  discount: 0,
  note: "No note",
  categoryList: [{ masterCategoryId: "mugs", isDone: false }],
  productDetails: [
    {
      product: {
        _id: "p1",
        itemName: "Mug",
        itemRef: "M1",
        unit: "PCS",
        ratio: 12,
        sellingPrice: 10,
      },
      categoryId: "cat1",
      storeCost: 10,
      catalogStoreCost: 10,
      aggregateCost: 120,
      quantityReq: 1,
      unitReq: "CARTONS",
      quantityAv: 1,
      unitAv: "CARTONS",
      isChecked: false,
      productionStatus: "Assigned",
      assignedWorkers: [{ employee: "w1", cartonQty: 1 }],
      manualCompletedQty: 1,
    },
  ],
} as ApprovalOrder;

describe("shmp order edit helpers", () => {
  it("builds editable lines from order detail", () => {
    const lines = shmpEditLinesFromDetail({
      order,
      lines: [
        {
          product: { _id: "p1", itemName: "Mug" },
          ordered: 1,
          produced: 1,
          delivered: 0,
          productionStatus: "Assigned",
          manualCompletedQty: 1,
        },
      ],
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].productId, "p1");
    assert.equal(lines[0].packedQty, 1);
    assert.equal(lines[0].ratio, 12);
    assert.equal(shmpOrderSectionFromDetail({
      order,
      lines: [{ ordered: 1, produced: 1, delivered: 0, ready: 1 }],
    }), "ready");
  });

  it("derives carton ratio from aggregate when product ratio is missing", () => {
    assert.equal(
      ratioFromApprovalLine({
        quantityReq: 2,
        storeCost: 5,
        aggregateCost: 120,
        unitReq: "CARTONS",
      }),
      12,
    );
  });

  it("updates qty and validates packed vs ordered", () => {
    const lines = shmpEditLinesFromDetail({ order, lines: [{ product: { _id: "p1" }, produced: 1, delivered: 0 }] });
    const next = updateShmpEditLine(lines, "p1", { quantityReq: 2, packedQty: 1 });
    assert.equal(next[0].quantityReq, 2);
    assert.equal(validateShmpEditLines(next), null);
    assert.equal(
      validateShmpEditLines(updateShmpEditLine(lines, "p1", { packedQty: 5 })),
      "Mug: packed qty cannot exceed ordered qty",
    );
  });

  it("builds a tempOrder edit payload that skips approval", () => {
    const lines = shmpEditLinesFromDetail({
      order,
      lines: [{ product: { _id: "p1" }, produced: 1, delivered: 0 }],
    });
    const totals = shmpEditCartTotals(lines);
    const payload = buildShmpEditTempOrderPayload(order, lines, {
      discount: 0,
      payableAmount: totals.totalCost * 1.05,
      payableEdited: false,
      note: "Updated",
      date: "2026-11-12",
    });
    assert.equal(payload.editFlag, "true");
    assert.equal(payload.tempOrderId, "ord1");
    assert.equal(payload.salesId, "sales1");
    assert.equal(payload.placeApprovedOrder, true);
    assert.equal(payload.needsApproval, false);
    assert.deepEqual(packedQtyPayload(lines), [{ productId: "p1", completedQty: 1 }]);
  });

  it("adds a catalog product onto the edit lines", () => {
    const lines = shmpEditLinesFromDetail({ order, lines: [] });
    const result = addProductToShmpEditLines(
      lines,
      {
        _id: "p2",
        itemName: "Jar",
        itemRef: "J1",
        unit: "PCS",
        ratio: 6,
        sellingPrice: 8,
        categoryId: "cat2",
        masterCategoryId: "jars",
        category: { _id: "cat2", masterCategoryId: "jars" },
      },
      3,
      "CARTONS",
    );
    assert.equal(result.error, undefined);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[1].productId, "p2");
    assert.equal(result.lines[1].quantityReq, 3);
  });
});

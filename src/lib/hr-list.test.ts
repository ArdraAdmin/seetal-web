import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortHrStaff } from "./hr-list.ts";
import { loanBalance, voucherDocumentHtml } from "./hr-ledger.ts";
import { countPendingForCompany } from "./approval-count.ts";

describe("sortHrStaff", () => {
  const rows = [
    { name: "Zara", joiningDate: "2024-01-01", visaExpiry: "2027-01-01" },
    { name: "amir", joiningDate: "2020-05-01", visaExpiry: null },
    { name: "Bea", joiningDate: null, visaExpiry: "2026-06-01" },
  ];

  it("sorts alphabetically without case", () => {
    assert.deepEqual(
      sortHrStaff(rows, "name").map((row) => row.name),
      ["amir", "Bea", "Zara"],
    );
  });

  it("puts the earliest joining date first and missing dates last", () => {
    assert.deepEqual(
      sortHrStaff(rows, "oldest").map((row) => row.name),
      ["amir", "Zara", "Bea"],
    );
  });

  it("puts the soonest visa expiry first", () => {
    assert.deepEqual(
      sortHrStaff(rows, "visa").map((row) => row.name),
      ["Bea", "Zara", "amir"],
    );
  });
});

describe("loanBalance", () => {
  it("subtracts receipts from the amount issued", () => {
    assert.equal(
      loanBalance({
        amount: 1000,
        repayments: [{ entryId: "a", voucherNo: "RV", date: "2026-08-01", amount: 250 }],
      }),
      750,
    );
  });
});

describe("voucherDocumentHtml", () => {
  it("prints the voucher number and escapes the staff name", () => {
    const html = voucherDocumentHtml({
      title: "Loan voucher",
      voucherNo: "LV-20260801-AB",
      date: "01/08/2026",
      staffName: "Ali <script>",
      amount: "AED 500",
      particulars: "Advance",
    });
    assert.match(html, /LV-20260801-AB/);
    assert.match(html, /Ali &lt;script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  });
});

describe("countPendingForCompany", () => {
  it("counts waiting orders for one company", () => {
    assert.equal(
      countPendingForCompany(
        [
          { approvalStatus: "pending", company: "shmp-id" },
          { approvalStatus: "pending", company: { _id: "stl-id" } },
          { approvalStatus: "approved", company: "shmp-id" },
        ],
        "shmp-id",
      ),
      1,
    );
  });
});

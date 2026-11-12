import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  amountInDirhams,
  buildSalarySlipPdf,
  SALARY_SLIP_COMPANY,
  salarySlipFilename,
  type SalarySlipPdfInput,
} from "./salary-slip-pdf.ts";

function pdfText(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("latin1");
}

function assertValidPdf(bytes: Uint8Array) {
  const text = pdfText(bytes);
  assert.equal(text.startsWith("%PDF-1.4\n"), true);
  assert.equal(text.trimEnd().endsWith("%%EOF"), true);
  const marker = text.lastIndexOf("startxref\n");
  const xrefOffset = Number(text.slice(marker + "startxref\n".length).split("\n")[0]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), "xref");
  for (const match of text.matchAll(/^(\d{10}) 00000 n $/gm)) {
    const offset = Number(match[1]);
    assert.match(text.slice(offset, offset + 12), /^\d+ 0 obj/);
  }
  return text;
}

const sample: SalarySlipPdfInput = {
  employeeName: "Sumesh Jagdish Makhija",
  salaryMonth: "June 2026",
  designation: "Sales",
  code: "",
  group: "General",
  basicSalary: 6000,
  otWeekdays: 0,
  otSundays: 0,
  otPublicHolidays: 0,
  otherBenefits: 0,
  totalSalary: 6000,
};

describe("salary slip pdf", () => {
  it("builds the SH Milly Pack bordered pay slip layout", () => {
    const text = assertValidPdf(buildSalarySlipPdf([sample]));
    assert.match(text, /PAY SLIP/);
    assert.match(text, new RegExp(SALARY_SLIP_COMPANY.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(text, /TECHONOLOGY PARK/);
    assert.match(text, /RAK FREE ZONE/);
    assert.match(text, /SUMESH JAGDISH MAKHIJA/);
    assert.match(text, /Group/);
    assert.match(text, /General/);
    assert.match(text, /Designation/);
    assert.match(text, /SALES/);
    assert.match(text, /JUNE 2026/);
    assert.match(text, /Earnings/);
    assert.match(text, /Deductions/);
    assert.match(text, /Contributions/);
    assert.match(text, /Adjustments/);
    assert.match(text, /Basic/);
    assert.match(text, /OB/);
    assert.match(text, /Gross/);
    assert.match(text, /Net Payable/);
    assert.match(text, /AED6,000\.00/);
    assert.match(text, /Dirhams Six Thousand Only/);
    assert.match(text, /Prepared By/);
    assert.match(text, /Verified By/);
    assert.match(text, /Authorised By/);
    assert.doesNotMatch(text, /\bDate\b/);
    assert.equal(text.includes("/Count 1"), true);
  });

  it("puts each selected person on a separate page", () => {
    const text = assertValidPdf(
      buildSalarySlipPdf([
        sample,
        { ...sample, employeeName: "Ahmed Khan", totalSalary: 5000, basicSalary: 5000 },
      ]),
    );
    assert.match(text, /SUMESH JAGDISH MAKHIJA/);
    assert.match(text, /AHMED KHAN/);
    assert.match(text, /Page 1 of 2/);
    assert.match(text, /Page 2 of 2/);
    assert.equal(text.includes("/Count 2"), true);
  });

  it("rejects an empty selection", () => {
    assert.throws(() => buildSalarySlipPdf([]), /at least one person/i);
  });

  it("names single and bulk downloads", () => {
    assert.equal(salarySlipFilename(2026, 6), "salary-slips-2026-06.pdf");
    assert.equal(
      salarySlipFilename(2026, 6, "Sumesh Jagdish Makhija"),
      "salary-slip-sumesh-jagdish-makhija-2026-06.pdf",
    );
  });

  it("converts amounts to dirham wording", () => {
    assert.equal(amountInDirhams(6000), "Dirhams Six Thousand Only");
    assert.equal(amountInDirhams(0), "Dirhams Zero Only");
    assert.equal(amountInDirhams(1250.5), "Dirhams One Thousand Two Hundred Fifty and Fifty Fils Only");
  });
});

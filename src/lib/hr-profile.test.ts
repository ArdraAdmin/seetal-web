import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyHrProfileForm,
  hrProfilePayload,
  hrProfileToForm,
  joiningDateError,
  stlTotalSalary,
  toDateInput,
  validateHrProfileForm,
} from "./hr-profile.ts";

describe("HR profile form", () => {
  it("requires a real joined date", () => {
    assert.equal(joiningDateError(""), "Joined date is required");
    assert.equal(joiningDateError("   "), "Joined date is required");
    assert.equal(joiningDateError("2026-02-31"), "Joined date is invalid");
    assert.equal(joiningDateError("not-a-date"), "Joined date is invalid");
    assert.equal(joiningDateError("2026-03-01"), null);
  });

  it("keeps a date-only value and converts timestamps in Dubai", () => {
    assert.equal(toDateInput("2027-04-30"), "2027-04-30");
    assert.equal(toDateInput("2026-10-26T20:30:00.000Z"), "2026-10-27");
    assert.equal(toDateInput(""), "");
  });

  it("round-trips a saved file without sending the temporary url", () => {
    const form = hrProfileToForm(
      {
        visaName: "Aisha Khan",
        totalSalary: 4500,
        passportCopy: {
          key: "hr-documents/1-passport.pdf",
          fileName: "passport.pdf",
          url: "https://files.example/temporary",
        },
      },
      "Login name",
    );
    assert.equal(form.visaName, "Aisha Khan");
    assert.equal(form.totalSalary, "4500");
    assert.equal(form.sundayAllowance, "");
    const payload = hrProfilePayload(form);
    assert.deepEqual(payload.passportCopy, {
      key: "hr-documents/1-passport.pdf",
      fileName: "passport.pdf",
      contentType: undefined,
    });
  });

  it("asks for the required documents and allows an empty offer letter", () => {
    assert.equal(validateHrProfileForm(emptyHrProfileForm()), "Name as per visa is required");
    const form = emptyHrProfileForm();
    form.visaName = "Aisha Khan";
    form.visaDesignation = "Officer";
    form.passportNumber = "P1";
    form.passportExpiry = "2027-01-01";
    form.passportCopy = { key: "hr-documents/1-a.pdf", fileName: "a.pdf" };
    form.eidNumber = "784";
    form.eidExpiry = "2027-02-01";
    form.eidCopy = { key: "hr-documents/1-b.pdf", fileName: "b.pdf" };
    form.visaCopy = { key: "hr-documents/1-c.pdf", fileName: "c.pdf" };
    assert.equal(validateHrProfileForm(form), "Visa UID number is required");
    form.visaNumber = "UID-1";
    form.insuranceExpiry = "2027-03-01";
    form.insuranceCopy = { key: "hr-documents/1-d.pdf", fileName: "d.pdf" };
    form.employmentContractCopy = { key: "hr-documents/1-e.pdf", fileName: "e.pdf" };
    assert.equal(validateHrProfileForm(form), null);
    assert.equal(validateHrProfileForm(form, "shmp"), "Basic salary is required");
    form.basicSalary = "800";
    form.totalSalary = "2000";
    assert.equal(validateHrProfileForm(form, "shmp"), null);
    assert.equal(validateHrProfileForm(form, "stl"), "Other benefits is required");
    form.otherBenefits = "800";
    assert.equal(validateHrProfileForm(form, "stl"), null);
    assert.equal(
      validateHrProfileForm(form, "stl", undefined, { requireCompany: true }),
      "Company is required",
    );
    form.company = "stl-id";
    assert.equal(
      validateHrProfileForm(form, "stl", undefined, { requireCompany: true }),
      null,
    );
  });

  it("derives STL other benefits and auto-sums total salary", () => {
    const form = hrProfileToForm(
      { basicSalary: 800, overtimeSalary: 400, totalSalary: 2000 },
      "Aisha",
      "stl",
    );
    assert.equal(form.otherBenefits, "1200");
    assert.equal(form.totalSalary, "2000");
    assert.equal(stlTotalSalary({ basicSalary: "800", otherBenefits: "200" }), "1000");
    const payload = hrProfilePayload(
      { ...form, otherBenefits: "200" },
      "stl",
    );
    assert.equal(payload.totalSalary, 1000);
    assert.equal(payload.overtimeSalary, 400);
    assert.equal(payload.otherBenefits, 200);
    assert.equal("visaCost" in payload, false);
    assert.equal("visaDetails" in payload, false);
  });

  it("uses the EID expiry as the visa expiry", () => {
    const form = hrProfileToForm(
      { eidExpiry: "2028-05-01", visaExpiry: "2020-01-01", visaNumber: "UID-9" },
      "Aisha",
    );
    assert.equal(form.visaExpiry, "2028-05-01");
    const payload = hrProfilePayload({ ...form, eidExpiry: "2029-06-01", visaExpiry: "2020-01-01" });
    assert.equal(payload.visaExpiry, "2029-06-01");
    assert.equal(payload.eidExpiry, "2029-06-01");
  });
});

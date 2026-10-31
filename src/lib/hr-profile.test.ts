import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptyHrProfileForm,
  hrProfilePayload,
  hrProfileToForm,
  toDateInput,
  validateHrProfileForm,
} from "./hr-profile.ts";

describe("HR profile form", () => {
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
    form.insuranceExpiry = "2027-03-01";
    form.insuranceCopy = { key: "hr-documents/1-d.pdf", fileName: "d.pdf" };
    form.employmentContractCopy = { key: "hr-documents/1-e.pdf", fileName: "e.pdf" };
    assert.equal(validateHrProfileForm(form), null);
  });
});

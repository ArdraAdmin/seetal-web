import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isVehicleObjectKey,
  maintenanceFormError,
  vehicleFormError,
  vehicleObjectKey,
  viewableVehicleFileType,
} from "./vehicle-records.ts";

const NOW = new Date("2026-10-31T00:00:00Z");

const validVehicle = {
  vehicleNumber: "1234",
  purchaseYear: "2022",
  price: "45000",
  purchaseFrom: "Dealer",
  mulkyaExpiry: "2027-01-15",
  insurancePremium: "1200",
};

const pdf = { name: "scan.pdf", type: "application/pdf", size: 1200 };

describe("vehicle form", () => {
  it("accepts a complete vehicle without documents", () => {
    assert.equal(vehicleFormError(validVehicle, NOW), null);
  });

  it("requires mulkya expiry and insurance premium", () => {
    assert.equal(
      vehicleFormError({ ...validVehicle, mulkyaExpiry: "" }, NOW),
      "Enter a mulkya expiry",
    );
    assert.equal(
      vehicleFormError({ ...validVehicle, insurancePremium: "" }, NOW),
      "Enter an insurance premium",
    );
    assert.equal(
      vehicleFormError({ ...validVehicle, insurancePremium: "0" }, NOW),
      null,
    );
  });

  it("keeps purchase details optional and rejects invalid numbers", () => {
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          purchaseYear: "",
          price: "",
          purchaseFrom: "",
        },
        NOW,
      ),
      null,
    );
    assert.equal(
      vehicleFormError({ ...validVehicle, purchaseYear: "1979" }, NOW),
      "Purchase year must be at least 1980",
    );
    assert.equal(
      vehicleFormError({ ...validVehicle, price: "-1" }, NOW),
      "Price must be at least 0",
    );
    assert.equal(
      vehicleFormError({ ...validVehicle, vehicleNumber: "abc" }, NOW),
      "Enter a valid vehicle number",
    );
  });

  it("allows a blank document row and requires a name plus file when one is filled", () => {
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [{ name: "  ", file: null }],
        },
        NOW,
      ),
      null,
    );
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [{ name: "Mulkya copy", file: null }],
        },
        NOW,
      ),
      "Upload a file for Mulkya copy",
    );
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [{ name: "", file: pdf }],
        },
        NOW,
      ),
      "Name each document before uploading",
    );
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [{ name: "Mulkya copy", file: pdf }],
        },
        NOW,
      ),
      null,
    );
  });

  it("rejects unsupported or oversized document files", () => {
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [
            {
              name: "Notes",
              file: { name: "notes.txt", type: "text/plain", size: 20 },
            },
          ],
        },
        NOW,
      ),
      "Notes must be a PDF, JPEG, PNG, or WebP file",
    );
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [
            {
              name: "Scan",
              file: {
                name: "scan.pdf",
                type: "application/pdf",
                size: 10 * 1024 * 1024 + 1,
              },
            },
          ],
        },
        NOW,
      ),
      "Scan must be 10 MB or smaller",
    );
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          documents: [
            {
              name: "Photo",
              file: { name: "photo.JPG", type: "", size: 40 },
            },
          ],
        },
        NOW,
      ),
      null,
    );
  });

  it("counts saved documents toward the limit", () => {
    assert.equal(
      vehicleFormError(
        {
          ...validVehicle,
          savedDocumentCount: 20,
          documents: [{ name: "Extra", file: pdf }],
        },
        NOW,
      ),
      "A vehicle can have at most 20 documents",
    );
  });
});

describe("vehicle object keys", () => {
  it("builds an S3 key and rejects anything else", () => {
    const key = vehicleObjectKey("eBio manual.pdf");
    assert.equal(isVehicleObjectKey(key), true);
    assert.equal(key.startsWith("vehicle-files/"), true);
    assert.equal(key.endsWith("-eBio_manual.pdf"), true);
    assert.equal(isVehicleObjectKey("documents/file.pdf"), false);
    assert.equal(isVehicleObjectKey("../vehicle-files/1-ab-file.pdf"), false);
  });
});

describe("viewable vehicle files", () => {
  it("keeps a browser-viewable type from the file response", () => {
    assert.equal(
      viewableVehicleFileType("application/pdf", "scan.bin"),
      "application/pdf",
    );
    assert.equal(
      viewableVehicleFileType("image/jpeg; charset=binary", "photo"),
      "image/jpeg",
    );
  });

  it("falls back to the file name when the response type cannot be shown", () => {
    assert.equal(
      viewableVehicleFileType("application/octet-stream", "manual.PDF"),
      "application/pdf",
    );
    assert.equal(viewableVehicleFileType("", "photo.png"), "image/png");
    assert.equal(
      viewableVehicleFileType("", "notes.txt"),
      "application/octet-stream",
    );
  });
});

describe("maintenance form", () => {
  const valid = {
    title: "Oil change",
    amount: "250",
    description: "Filter replaced",
    date: "2026-10-01",
    invoice: pdf,
  };

  it("requires an invoice file", () => {
    assert.equal(maintenanceFormError(valid), null);
    assert.equal(
      maintenanceFormError({ ...valid, invoice: null }),
      "Upload an invoice",
    );
    assert.equal(
      maintenanceFormError({
        ...valid,
        invoice: { name: "invoice.txt", type: "text/plain", size: 10 },
      }),
      "Invoice must be a PDF, JPEG, PNG, or WebP file",
    );
  });

  it("still requires the maintenance details", () => {
    assert.equal(
      maintenanceFormError({ ...valid, title: " " }),
      "Enter a maintenance title",
    );
    assert.equal(
      maintenanceFormError({ ...valid, amount: "" }),
      "Enter a maintenance amount",
    );
    assert.equal(
      maintenanceFormError({ ...valid, date: "" }),
      "Enter a maintenance date",
    );
  });
});

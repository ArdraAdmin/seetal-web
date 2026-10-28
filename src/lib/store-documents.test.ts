import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasStoreDocument,
  storeDocumentError,
} from "./store-documents.ts";

const file = (name: string) => new File(["doc"], name, { type: "application/pdf" });

describe("store documents", () => {
  it("treats a selected file or existing URL as present", () => {
    assert.equal(hasStoreDocument(null, ""), false);
    assert.equal(hasStoreDocument(null, "https://example.com/trn.pdf"), true);
    assert.equal(hasStoreDocument(file("trn.pdf"), ""), true);
  });

  it("requires both files and an expiry date when creating a store", () => {
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: null,
          tradeLicenseExpiry: "",
        },
        "create",
      ),
      "Enter a trade license expiry date",
    );
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: file("license.pdf"),
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "create",
      ),
      "Upload a TRN document",
    );
    assert.equal(
      storeDocumentError(
        {
          trnDocument: file("trn.pdf"),
          tradeLicenseDocument: null,
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "create",
      ),
      "Upload a trade license document",
    );
    assert.equal(
      storeDocumentError(
        {
          trnDocument: file("trn.pdf"),
          tradeLicenseDocument: file("license.pdf"),
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "create",
      ),
      null,
    );
  });

  it("accepts existing documents when editing a store that persists files", () => {
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: null,
          existingTrnUrl: "https://example.com/trn.pdf",
          existingTradeLicenseUrl: "https://example.com/license.pdf",
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "edit",
      ),
      null,
    );
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: file("license.pdf"),
          existingTrnUrl: "",
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "edit",
      ),
      "Upload a TRN document",
    );
  });

  it("does not require files on edit when documents are not persisted yet", () => {
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: null,
          tradeLicenseExpiry: "2026-12-01T00:00",
        },
        "edit",
        false,
      ),
      null,
    );
    assert.equal(
      storeDocumentError(
        {
          trnDocument: null,
          tradeLicenseDocument: null,
          tradeLicenseExpiry: "",
        },
        "edit",
        false,
      ),
      "Enter a trade license expiry date",
    );
  });
});
